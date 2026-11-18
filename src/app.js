import {shots,shotAt,duration,smooth} from "./timeline.js";
import {Firefall} from "./horsetail.js";
const movie="/media/Firefall-procedural.mp4";

const $=s=>document.querySelector(s);
const stage=$("#stage"),canvas=$("#scene"),score=$("#score"),video=$("#fallback");
const capture=new URLSearchParams(location.search).has("render");
const reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
const stamp=t=>"00:"+String(Math.floor(t)).padStart(2,"0");
let engine,media=score,engaged=false,muted=false,working=false,raf=0,timer=0;
let coverEpoch=performance.now(),aliveUntil=coverEpoch+11000,awakeUntil=0;
let pointer=null,targetX=0,targetY=0,headX=0,headY=0,lastTime=-1,activeShot=-1;
let requestedRevision=0,lastRevision=-1;
let livePixels=1050000,lastPlaybackTick=0,cadence=42,lastAdjustment=0;
const warm=new Set();

function resize(){
  if(!engine||capture)return;
  const {width,height}=stage.getBoundingClientRect();
  const scale=Math.min(devicePixelRatio,1.5,1660/width,970/height,Math.sqrt(livePixels/(width*height)));
  engine.resize(Math.max(2,Math.round(width*scale)),Math.max(2,Math.round(height*scale)));
  refresh();
}
function refresh(){
  requestedRevision++;
  if(document.hidden||capture)return;
  if(!working && !raf && !timer)raf=requestAnimationFrame(tick);
}
function wake(){
  awakeUntil=performance.now()+2300;stage.classList.add("awake");refresh();
}
function controls(t){
  const play=!media.paused;
  const btn=$("#transport");
  const state=play?"Pause":"Play";
  if(btn.dataset.state!==state){
    btn.innerHTML='<svg class="icon"><use href="#'+(play?"pause":"play")+'"/></svg>';
    btn.setAttribute("aria-label",state+" film");btn.dataset.state=state;
  }
  $("#elapsed").textContent=stamp(t);
  $("#seek").value=t;$("#seek").style.setProperty("--p",(t/duration*100)+"%");
  const index=shots.indexOf(shotAt(t));
  if(index!==activeShot){
    document.querySelectorAll(".shot").forEach((button,i)=>{
      button.classList.toggle("active",i===index);
      if(i===index)button.setAttribute("aria-current","true");else button.removeAttribute("aria-current");
    });
    activeShot=index;
  }
  $("#credit").style.opacity=media===video?0:smooth(35.8,36.6,t)*(1-smooth(39.55,40,t));
  if(!play||performance.now()<awakeUntil)stage.classList.add("awake");
  else stage.classList.remove("awake");
}
async function tick(now){
  raf=0;timer=0;
  if(document.hidden||capture||working)return;
  working=true;
  const revision=requestedRevision;
  let needsAnother=false;
  try{
    if(engaged&&!media.paused&&engine){
      const interval=now-lastPlaybackTick;
      if(lastPlaybackTick && interval<250)cadence=cadence*.90+interval*.10;
      if(now-lastAdjustment>2800){
        const next=cadence>58?Math.max(405000,livePixels*.76):cadence<43?Math.min(1050000,livePixels*1.08):livePixels;
        if(Math.abs(next-livePixels)>12000){livePixels=next;resize();}
        lastAdjustment=now;
      }
      lastPlaybackTick=now;
    }else lastPlaybackTick=0;
    const t=engaged?Math.min(duration,media.currentTime||0):(now-coverEpoch)*.001;
    headX+=(targetX-headX)*.17;headY+=(targetY-headY)*.17;
    if(engine && (t!==lastTime||lastRevision!==revision)){
      await engine.draw(t,{cover:!engaged,x:headX,y:headY});
    }
    lastTime=t;lastRevision=revision;
    if(engaged){
      controls(t);
      const shot=shotAt(t),next=shots[shots.indexOf(shot)+1];
      if(engine && next && t>shot.end-1.6 && !warm.has(next.start)){
        warm.add(next.start);engine.prepare(next).catch(()=>warm.delete(next.start));
      }
    }
    needsAnother=(engaged && !media.paused)||(!engaged && now<aliveUntil && !reduced)||
      Math.abs(headX-targetX)+Math.abs(headY-targetY)>.004||requestedRevision!==revision;
  }catch(error){
    console.error("Scene playback",error);
    enableVideo();
  }finally{working=false;}
  if(needsAnother&&!document.hidden){
    const interval=engaged?1000/24:1000/16;
    timer=setTimeout(()=>{timer=0;raf=requestAnimationFrame(tick);},Math.max(4,interval-(performance.now()-now)-8));
  }
}
function enableVideo(){
  const at=media.currentTime||0,wasPlaying=!media.paused;
  score.pause();engine=null;media=video;
  if(!video.src)video.src=movie;
  video.muted=muted;video.hidden=!engaged;canvas.hidden=true;
  $(".look").hidden=true;video.currentTime=at;
  if(wasPlaying)video.play().catch(()=>{});
  refresh();
}
function start(at){
  if(typeof at==="number")media.currentTime=Math.min(39.96,Math.max(0,at));
  else if(!engaged || media.ended)media.currentTime=0;
  engaged=true;stage.classList.add("engaged");$("#cover").inert=true;
  if(media===video)video.hidden=false;
  media.muted=muted;
  media.play().catch(error=>{if(error.name!=="AbortError")console.warn("Playback",error.message);refresh();});
  wake();
}
function toggle(){
  if(!engaged||media.paused)start();
  else{media.pause();wake();}
}
function endFilm(){
  if(media.currentTime<duration-.12 && !media.ended)return;
  engaged=false;stage.classList.remove("engaged","awake");$("#cover").inert=false;
  $("#watch").innerHTML='<svg class="icon small"><use href="#play"/></svg>Replay film';
  $("#credit").style.opacity=0;video.hidden=true;
  coverEpoch=performance.now();aliveUntil=coverEpoch+2500;
  document.querySelectorAll(".shot").forEach(b=>{b.classList.remove("active");b.removeAttribute("aria-current");});
  activeShot=-1;refresh();
}
function full(){
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  else stage.requestFullscreen().catch(()=>{});
}
function toggleSound(){
  muted=!muted;media.muted=muted;
  $("#sound").setAttribute("aria-pressed",String(!muted));$("#sound-label").textContent=muted?"Sound off":"Sound on";
}
function buildInterface(){
  $(".download").href=movie;
  for(const [i,shot] of shots.entries()){
    const b=document.createElement("button");b.className="shot";b.setAttribute("aria-label","Play "+shot.title+" at "+stamp(shot.start));
    b.innerHTML='<span class="thumb"><canvas width="240" height="108" aria-hidden="true"></canvas><span class="shot-time">'+stamp(shot.start)+'</span></span><span class="caption"><span class="shot-number">'+String(i+1).padStart(2,"0")+'</span>'+shot.title+'</span>';
    b.onclick=()=>start(shot.start);$("#shots").append(b);
  }
  $("#watch").onclick=()=>start(0);$("#transport").onclick=toggle;$("#cover-full").onclick=$("#full").onclick=full;
  $("#sound").onclick=toggleSound;
  $("#seek").oninput=e=>{media.currentTime=Number(e.target.value);wake();};
  const notes=$("#notes-dialog");let resume=false;
  $("#notes").onclick=()=>{resume=engaged&&!media.paused;media.pause();notes.showModal();refresh();};
  $("#close").onclick=()=>notes.close();
  notes.addEventListener("click",e=>{if(e.target!==notes)return;const r=notes.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)notes.close();});
  notes.onclose=()=>{if(resume&&!document.hidden)start();resume=false;};
  for(const m of [score,video]){
    m.addEventListener("ended",endFilm);
    for(const event of ["seeked","pause","playing","loadedmetadata"])m.addEventListener(event,refresh);
  }
  document.addEventListener("fullscreenchange",()=>{
    for(const b of [$("#cover-full"),$("#full")])b.setAttribute("aria-label",document.fullscreenElement?"Exit fullscreen":"Enter fullscreen");
    resize();
  });
  stage.addEventListener("pointermove",e=>{
    if(engaged)wake();
    if(!pointer)return;
    targetX=Math.max(-1,Math.min(1,pointer.sx+(e.clientX-pointer.x)/160));
    targetY=Math.max(-1,Math.min(1,pointer.sy-(e.clientY-pointer.y)/130));
    if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)pointer.dragged=true;
    aliveUntil=performance.now()+1300;refresh();
  });
  canvas.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    pointer={x:e.clientX,y:e.clientY,sx:targetX,sy:targetY,dragged:false};
    canvas.setPointerCapture(e.pointerId);canvas.classList.add("grabbing");
  });
  canvas.addEventListener("pointerup",()=>{
    if(pointer&&!pointer.dragged&&engaged)toggle();
    pointer=null;canvas.classList.remove("grabbing");
  });
  canvas.addEventListener("pointercancel",()=>{pointer=null;canvas.classList.remove("grabbing");});
  video.addEventListener("click",toggle);
  window.addEventListener("keydown",e=>{
    if(notes.open||e.altKey||e.metaKey||e.ctrlKey||e.target.closest("input,textarea,select,[contenteditable=true]"))return;
    if(e.code==="Space"&&!e.target.closest("button,a")){e.preventDefault();toggle();}
    if(e.key.toLowerCase()==="f")full();
    if(e.key.toLowerCase()==="m")toggleSound();
    if(/^[1-7]$/.test(e.key))start(shots[Number(e.key)-1].start);
    if(engaged&&["ArrowRight","ArrowLeft"].includes(e.key)){e.preventDefault();media.currentTime=Math.max(0,Math.min(39.96,media.currentTime+(e.key==="ArrowRight"?2:-2)));wake();}
  });
  document.addEventListener("visibilitychange",()=>{
    clearTimeout(timer);cancelAnimationFrame(raf);raf=timer=0;
    if(document.hidden)media.pause();else refresh();
  });
  canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();enableVideo();});
  new ResizeObserver(resize).observe(stage);
}
async function boot(){
  if(!capture)buildInterface();
  const scene=new Firefall(canvas,capture);
  const watch=$("#watch"),label=watch.innerHTML;
  if(!capture){watch.textContent="Preparing scene...";watch.disabled=true;}
  await scene.init(capture?null:async preview=>{
    const box=stage.getBoundingClientRect(),scale=Math.min(1,840/Math.max(1,box.width));
    preview.resize(Math.max(2,Math.round(box.width*scale)),Math.max(2,Math.round(box.height*scale)));
    await preview.draw(0,{cover:true});
  });
  engine=scene;
  if(capture){
    document.body.style.visibility="hidden";canvas.style.visibility="visible";
    window.film={
      size:(w,h)=>engine.resize(w,h),
      frame:(t,options)=>engine.draw(t,options),
      expose:t=>engine.expose(t),
      jpeg:async(t,quality=.98)=>{
        await engine.expose(t);
        const blob=await new Promise((yes,no)=>canvas.toBlob(b=>b?yes(b):no(new Error("Frame readback failed")),"image/jpeg",quality));
        return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      },
      gpu:()=>{const gl=engine.renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):"WebGL2";},
      stats:()=>({...engine.renderer.info.memory})
    };
  }else{
    engine.resize(240,108);
    for(const [i,preview] of document.querySelectorAll(".thumb canvas").entries()){
      const shot=shots[i];
      await engine.draw(i===0?6.65:(shot.start+shot.end)/2);
      preview.getContext("2d").drawImage(canvas,0,0,240,108);
    }
    resize();await engine.draw(0,{cover:true});watch.innerHTML=label;watch.disabled=false;coverEpoch=performance.now();aliveUntil=coverEpoch+7000;refresh();
    const firstShot=()=>{if(engine&&!document.hidden)engine.prepare(shots[0]).catch(()=>{});};
    if(window.requestIdleCallback)requestIdleCallback(firstShot,{timeout:1800});
    else setTimeout(firstShot,900);
  }
}
boot().catch(error=>{
  if(capture){window.filmError=String(error);console.error(error);}
  else{console.warn("Using the rendered film",error.message);$("#watch").textContent="Play film";$("#watch").disabled=false;enableVideo();}
});
