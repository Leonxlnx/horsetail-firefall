param([Parameter(Mandatory=$true)][int]$Worker, [Parameter(Mandatory=$true)][string]$Sample)
$ErrorActionPreference='Stop'
$rootProcess=Get-Process -Id $Worker -ErrorAction SilentlyContinue
if(!$rootProcess){exit}
$birth=$rootProcess.StartTime
$previous=@{}
$lastClock=0.0
$lastCpu=@{}
$cpuClock=[Diagnostics.Stopwatch]::StartNew()
while($true){
  $rootProcess=Get-Process -Id $Worker -ErrorAction SilentlyContinue
  if(!$rootProcess -or $rootProcess.StartTime -ne $birth){break}
  try{
    $tree=Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId
    $owned=[System.Collections.Generic.HashSet[int]]::new()
    [void]$owned.Add($Worker)
    do {
      $before=$owned.Count
      foreach($entry in $tree){if($owned.Contains([int]$entry.ParentProcessId)){[void]$owned.Add([int]$entry.ProcessId)}}
    }while($before -lt $owned.Count)
    $privateBytes=0L;$freshCpu=@{};$consumed=0.0
    foreach($child in (Get-Process -Id @($owned) -ErrorAction SilentlyContinue)){
      $privateBytes+=$child.PrivateMemorySize64
      $freshCpu[$child.Id]=$child.TotalProcessorTime.TotalSeconds
      if($lastCpu.ContainsKey($child.Id)){$consumed+=[Math]::Max(0,$freshCpu[$child.Id]-$lastCpu[$child.Id])}
      try{if($child.PriorityClass -notin @('Idle','BelowNormal')){$child.PriorityClass='BelowNormal'}}catch{}
    }
    $cpuPercent=100*$consumed/[Math]::Max(.05,$cpuClock.Elapsed.TotalSeconds)/[Environment]::ProcessorCount
    $cpuClock.Restart();$lastCpu=$freshCpu
    $device=@{};$ours=@{};$fresh=@{};$clock=0.0
    $engines=Get-CimInstance Win32_PerfRawData_GPUPerformanceCounters_GPUEngine -Filter "Name LIKE '%engtype_3D%'"
    foreach($engine in $engines){
      if($engine.Name -notmatch '^pid_(\d+)_(.+)$'){continue}
      $processNumber=[int]$matches[1];$unit=$matches[2];$key=$engine.Name
      $fresh[$key]=[double]$engine.RunningTime;$clock=[double]$engine.Timestamp_Sys100NS
      if(!$previous.ContainsKey($key)){continue}
      $delta=[Math]::Max(0,$fresh[$key]-$previous[$key])
      $device[$unit]+=$delta
      if($owned.Contains($processNumber)){$ours[$unit]+=$delta}
    }
    if($lastClock -gt 0 -and $clock -gt $lastClock){
      $elapsed=$clock-$lastClock;$external=0.;$ownLoad=0.;$total=0.
      foreach($unit in $device.Keys){
        $total=[Math]::Max($total,$device[$unit]/$elapsed)
        $ownLoad=[Math]::Max($ownLoad,[double]$ours[$unit]/$elapsed)
        $external=[Math]::Max($external,([double]$device[$unit]-[double]$ours[$unit])/$elapsed)
      }
      $sampleData=[ordered]@{timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();renderCPU=[Math]::Round($cpuPercent,2);renderGPU=[Math]::Round($ownLoad*100,1);otherGPU=[Math]::Round($external*100,1);totalGPU=[Math]::Round($total*100,1);renderPrivateMiB=[Math]::Round($privateBytes/1MB)}
      [IO.File]::WriteAllText($Sample,($sampleData|ConvertTo-Json -Compress))
    }
    $lastClock=$clock;$previous=$fresh
  }catch{}
  Start-Sleep -Seconds 12
}
