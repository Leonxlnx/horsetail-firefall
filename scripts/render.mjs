import {chromium} from "playwright-core";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import {existsSync,readFileSync} from "node:fs";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {once} from "node:events";
import {fileURLToPath} from "node:url";
import {shots} from "../src/timeline.js";
import {installVideoWriter} from "./avc-writer.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
process.chdir(root);
const work=path.join(root,".work"),proof=process.argv.includes("--proof");
os.setPriority(0,os.constants.priority.PRIORITY_BELOW_NORMAL);
const hash=createHash("sha256");
for(const file of ["src/app.js","src/horsetail.js","src/batholith.js","src/conifers.js","src/talus.js","src/spray.js","src/granite.js","src/timeline.js","src/optics.js","src/boughs.js","src/outcrops.js","src/skylight.js","src/ligaments.js","src/crystals.js","src/fractures.js","src/reflectance.js","scripts/avc-writer.mjs","scripts/render.mjs"]){
  hash.update(await fs.readFile(file));
}
const signature=hash.digest("hex").slice(0,16);
const cache=path.join(work,"reels",signature);let reels=cache;
if(process.argv.includes("--cache-path")){console.log(reels);process.exit(0);}
const url=process.env.FIREFALL_URL||"http://localhost:4187";
const bin=process.env.CHROME_PATH||[
  path.join(process.env.PROGRAMFILES||"","Google/Chrome/Application/chrome.exe"),
  path.join(process.env["PROGRAMFILES(X86)"]||"","Microsoft/Edge/Application/msedge.exe"),
  chromium.executablePath()
].find(existsSync);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function tool(command,args) {
  const child=spawn(command,args,{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",v=>stdout+=v);child.stderr.on("data",v=>stderr+=v);
  return new Promise((resolve,reject)=>{
    child.on("error",reject);child.on("close",code=>code?reject(new Error(stderr)):resolve(stdout));
  });
}
async function pixels(page,t,q=.985){
  return Buffer.from(await page.evaluate(([time,quality])=>window.film.jpeg(time,quality),[t,q]),"base64");
}
async function recordingComplete(file,count){
  if(!existsSync(file))return false;
  try{
    const data=await tool("ffprobe",["-v","error","-select_streams","v:0","-show_entries","stream=width,height,nb_frames,avg_frame_rate,duration","-of","json",file]);
    const s=JSON.parse(data).streams[0];
    return Number(s.nb_frames)===count && s.width===1920 && s.height===1080 &&
      s.avg_frame_rate==="24/1" && Math.abs(Number(s.duration)-count/24)<.0001;
  }catch{return false;}
}
const cpuSample=()=>os.cpus().reduce((a,c)=>[a[0]+c.times.idle,a[1]+Object.values(c.times).reduce((s,n)=>s+n,0)],[0,0]);
const gpuSample=path.join(work,"capture-budget-"+process.pid+".json");
let budgetWatcher,hardwareMode=false,devicePacing=530;
let lastCpu=cpuSample(),spacing=380,frameWork=60;
function gpuBudget(){
  try{
    const value=JSON.parse(readFileSync(gpuSample,"utf8").replace(/^\uFEFF/,""));
    if(Date.now()-value.timestamp<75000)return value;
  }catch{}
  return {};
}
function resourceBudget(){
  const next=cpuSample();
  const busy=1-(next[0]-lastCpu[0])/Math.max(1,next[1]-lastCpu[1]);
  lastCpu=next;
  const free=os.freemem()/1073741824;
  const gpu=gpuBudget();
  const graphicsFloor=gpu.otherGPU>78?4200:gpu.otherGPU>56?2100:gpu.otherGPU>35?960:0;
  if(hardwareMode){
    if(gpu.renderGPU>17)devicePacing=Math.min(3100,devicePacing*1.24);
    else if(gpu.renderGPU<9)devicePacing=Math.max(490,devicePacing*.9);
    const sharedFloor=free<3?5000:free<5?1900:busy>.88?(gpu.renderCPU>3.3?1600:850):busy>.73?650:450;
    spacing=Math.max(graphicsFloor,sharedFloor,Math.round(devicePacing),Math.min(1500,Math.round(frameWork*2.75)));
  }else{
    spacing=Math.max(graphicsFloor,free<3?5000:free<5||busy>.88?1900:busy>.73?920:380,Math.min(2400,Math.round(frameWork*4.7)));
  }
  return {hostCPU:Math.round(busy*100)+"%",freeRAM:free.toFixed(1)+" GiB",renderCPU:gpu.renderCPU,renderGPU:gpu.renderGPU,otherGPU:gpu.otherGPU,renderPrivateMiB:gpu.renderPrivateMiB,minFrameInterval:spacing+" ms"};
}
async function encodeShot(page,index){
  const shot=shots[index],first=Math.round(shot.start*24),count=Math.round((shot.end-shot.start)*24);
  const file=path.join(reels,index+".mp4"),partial=file.replace(".mp4","."+process.pid+".partial.mp4");
  if(await recordingComplete(file,count)){console.log("Verified existing reel",index+1);return;}
  const filters=["scale=in_range=pc:out_range=tv:out_color_matrix=bt709","format=yuv420p","setsar=1"];
  const args=hardwareMode?["-hide_banner","-loglevel","error","-y","-fflags","+genpts","-threads","1","-r","24","-f","h264","-i","pipe:0","-map","0:v:0","-an","-c:v","copy",partial]:["-hide_banner","-loglevel","error","-y","-threads","1","-f","image2pipe","-framerate","24",
    "-c:v","mjpeg","-i","pipe:0","-filter_threads","1","-vf",filters.join(","),"-an","-c:v","libx264",
    "-preset","medium","-crf","16","-threads","2","-x264-params","lookahead_threads=1:rc-lookahead=18",
    "-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709","-color_range","tv","-pix_fmt","yuv420p",partial];
  if(hardwareMode)await page.evaluate(()=>window.avcWriter.begin());
  const ff=spawn("ffmpeg",args,{windowsHide:true,stdio:["pipe","ignore","pipe"]});
  let errors="";ff.stderr.on("data",s=>errors+=s);ff.stdin.on("error",()=>{});
  const closed=once(ff,"close");
  console.log("Rendering",index+1,shot.title,count+" frames");
  async function append(bytes){
    if(ff.exitCode!==null)throw new Error(errors||"Encoder exited");
    if(bytes.length&&!ff.stdin.write(bytes))await Promise.race([once(ff.stdin,"drain"),closed.then(()=>{throw new Error(errors||"Encoder stopped");})]);
  }
  try{
    for(let n=0;n<count;n++){
      const before=performance.now();
      const t=(first+n)/24;
      const bytes=hardwareMode?Buffer.from(await page.evaluate(([time,i])=>window.avcWriter.push(time,i),[t,n]),"base64"):await pixels(page,t);
      frameWork=.90*frameWork+.10*(performance.now()-before);
      await append(bytes);
      if(n%16===0){const resources=resourceBudget();if(n%48===0)console.log(first+n,"/ 960",resources);}
      await sleep(Math.max(8,spacing-(performance.now()-before)));
    }
    if(hardwareMode)await append(Buffer.from(await page.evaluate(()=>window.avcWriter.finish()),"base64"));
    ff.stdin.end();
    const [code]=await closed;
    if(code||!await recordingComplete(partial,count))throw new Error("Incomplete reel "+index+" "+errors);
    await fs.rename(partial,file);
  }catch(error){ff.stdin.destroy();ff.kill();throw error;}
}
async function assemble(){
  const credit="Music: Passage of Time by Scott Buckley — edited excerpt. https://www.scottbuckley.com.au/library/passage-of-time/ — licensed under CC BY 4.0 https://creativecommons.org/licenses/by/4.0/";
  await fs.writeFile(path.join(reels,"concat.txt"),shots.map((_,i)=>"file '"+i+".mp4'").join("\n"));
  let metadata=";FFMETADATA1\ntitle=Firefall\nartist=Field Atlas\ncomment="+credit+"\n";
  for(const s of shots)metadata+="[CHAPTER]\nTIMEBASE=1/1000\nSTART="+s.start*1000+"\nEND="+s.end*1000+"\ntitle="+s.title+"\n";
  await fs.writeFile(path.join(work,"film.ffmeta"),metadata);
  await tool("ffmpeg",["-v","error","-y","-f","concat","-safe","0","-i",path.join(reels,"concat.txt"),
    "-i","public/media/firefall-sound.m4a","-f","ffmetadata","-i",path.join(work,"film.ffmeta"),"-map","0:v:0","-map","1:a:0",
    "-map_metadata","2","-map_chapters","2","-c","copy","-movflags","+faststart","-t","40",path.join(work,"Firefall.mux.mp4")]);
  if(!await recordingComplete(path.join(work,"Firefall.mux.mp4"),960))throw new Error("Film frame-count mismatch");
  await fs.rename(path.join(work,"Firefall.mux.mp4"),path.join(root,"public/media/Firefall-procedural.mp4"));
  console.log("Finished 960 frames.");
}
await fs.mkdir(reels,{recursive:true});
if(process.platform==="win32"&&!proof){
  budgetWatcher=spawn("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",path.join(root,"scripts/render-budget.ps1"),"-Worker",String(process.pid),"-Sample",gpuSample],{windowsHide:true,stdio:"ignore"});
  budgetWatcher.on("error",()=>{});
}
const browser=await chromium.launch({executablePath:bin,headless:true,args:["--use-angle=d3d11","--enable-gpu",
  "--disable-background-timer-throttling","--disable-renderer-backgrounding","--renderer-process-limit=2","--num-raster-threads=1"]});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(300000);
  const faults=[],requests=new Set();
  page.on("pageerror",e=>{faults.push(e.message);console.error("Page error",e.message);});
  await page.route("**/*",async route=>{
    const target=new URL(route.request().url()),p=target.pathname;
    if(target.origin===new URL(url).origin && (p==="/" || p==="/style.css" || p==="/media/firefall-sound.m4a" || /^\/(src|vendor)\/[a-zA-Z0-9.-]+\.js$/.test(p))){
      requests.add(p);await route.continue();
    }else{faults.push("Unexpected input "+p);await route.abort();}
  });
  page.on("console",m=>{if(m.type()==="error"||m.type()==="warning"){console.log(m.type(),m.text());if(m.type()==="error")faults.push(m.text());}});
  if(proof){
    await page.goto(url);
    await page.waitForFunction(()=>document.querySelector("#scene").width>500&&!document.querySelector("#watch").disabled);
    await page.waitForTimeout(900);
    await page.screenshot({path:path.join(work,"screen-desktop.jpg"),quality:90});
    await page.locator("#notes").click();await page.locator("#close").click();
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
    await page.screenshot({path:path.join(work,"screen-mobile.jpg"),quality:90});
    await page.locator("#watch").click();await page.waitForTimeout(480);
    console.log("Playback",await page.locator("#score").evaluate(a=>({playing:!a.paused,clock:a.currentTime})));
    await page.setViewportSize({width:1280,height:720});
  }
  await page.goto(url+"/?render");
  await page.waitForFunction(()=>window.film||window.filmError,undefined,{timeout:300000});
  if(await page.evaluate(()=>Boolean(window.filmError)))throw new Error(await page.evaluate(()=>window.filmError));
  console.log("Renderer",await page.evaluate(()=>window.film?window.film.gpu():window.filmError));
  if(proof){
    await page.evaluate(()=>window.film.size(1280,720));
    for(const [i,t] of [0,3.5,6.75,9.1,13,19.5,24.6,30.85,33.45,36.5,39.4].entries()){
      await fs.writeFile(path.join(work,"proof-"+String(i).padStart(2,"0")+".jpg"),await pixels(page,t));
    }
    console.log("Proof frames complete.");
  }else{
    await page.evaluate(()=>window.film.size(1920,1080));
    if(process.argv.includes("--review")){
      const review=path.join(cache,"review");
      await fs.mkdir(review,{recursive:true});
      for(const [index,time] of [6.85,13.4,19.75,24.8,9.2,30.8,36.0].entries()){
        await fs.writeFile(path.join(review,(index+1)+".jpg"),await pixels(page,time));
        await sleep(300);
      }
      console.log("Full-resolution shot review ready",review);
    }
    async function cut(mode){
      hardwareMode=mode;reels=path.join(cache,mode?"direct-avc":"x264");await fs.mkdir(reels,{recursive:true});
      console.log("Capture path",mode?"WebCodecs direct AVC":"JPEG and two-thread libx264");
      for(let i=0;i<shots.length;i++){await encodeShot(page,i);if(faults.length)throw new Error(faults.join("\n"));}
    }
    if(!process.argv.includes("--software")&&await installVideoWriter(page)){
      try{await cut(true);}
      catch(error){
        if(faults.length)throw error;
        console.warn("Hardware capture unavailable",String(error));await page.evaluate(()=>window.avcWriter.close());
        await cut(false);
      }
    }else await cut(false);
    await assemble();
  }
  console.log("Requested inputs",[...requests].sort());if(faults.length)throw new Error(faults.join("\n"));
}finally{await browser.close();budgetWatcher?.kill();}
