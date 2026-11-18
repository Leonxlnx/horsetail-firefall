export async function installVideoWriter(page){
 return await page.evaluate(async()=>{
   if(!window.VideoEncoder||!window.VideoFrame)return false;
   const config={codec:"avc1.64002a",width:1920,height:1080,framerate:24,
     bitrate:46000000,bitrateMode:"variable",latencyMode:"realtime",hardwareAcceleration:"prefer-hardware",avc:{format:"annexb"}};
   if(!(await VideoEncoder.isConfigSupported(config)).supported)return false;
   let encoder,failed,packets=[];
   const bytes=async()=>{
     if(failed)throw failed;
     if(!packets.length)return "";
     const blob=new Blob(packets);packets=[];
     return await new Promise((resolve,reject)=>{
       const read=new FileReader();read.onload=()=>resolve(read.result.slice(read.result.indexOf(",")+1));
       read.onerror=reject;read.readAsDataURL(blob);
     });
   };
   window.avcWriter={
     begin(){
       if(encoder&&encoder.state!=="closed")encoder.close();
       packets=[];failed=null;
       encoder=new VideoEncoder({output:chunk=>{
         const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);packets.push(data);
       },error:e=>{failed=e;}});
       encoder.configure(config);
     },
     async push(t,n){
       if(failed)throw failed;
       await window.film.expose(t);
       const frame=new VideoFrame(document.querySelector("#scene"),{timestamp:Math.round(n*1e6/24),duration:Math.round(1e6/24)});
       try{encoder.encode(frame,{keyFrame:n%72===0});}finally{frame.close();}
       if(encoder.encodeQueueSize>3)await encoder.flush();
       return await bytes();
     },
     async finish(){
       try{await encoder.flush();return await bytes();}
       finally{if(encoder&&encoder.state!=="closed")encoder.close();}
     },
     close(){if(encoder&&encoder.state!=="closed")encoder.close();packets=[];}
   };
   return true;
 });
}
