import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4187);
const types={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".json":"application/json",
  ".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml",".ttf":"font/ttf",".m4a":"audio/mp4",
  ".mp4":"video/mp4",".bin":"application/octet-stream",".txt":"text/plain; charset=utf-8"};
http.createServer((req,res)=>{
  let url;
  try{url=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400).end();return;}
  let base=path.join(root,"public"),file=url.slice(1)||"index.html";
  if(url.startsWith("/vendor/")) {base=path.join(root,"node_modules/three/build");file=url.slice(8);}
  if(url.startsWith("/src/")) {base=path.join(root,"src");file=url.slice(5);}
  const target=path.resolve(base,file);
  if(!target.startsWith(base+path.sep)) {res.writeHead(404).end();return;}
  fs.stat(target,(err,stat)=>{
    if(err||!stat.isFile()) {res.writeHead(404).end();return;}
    const h={"Content-Type":types[path.extname(target)]||"application/octet-stream","Accept-Ranges":"bytes"};
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    let start=0,end=stat.size-1;
    if(range){
      start=Number(range[1]);end=Math.min(end,Number(range[2]||end));
      if(start>end){res.writeHead(416,{"Content-Range":"bytes */"+stat.size}).end();return;}
      h["Content-Range"]=`bytes ${start}-${end}/${stat.size}`;
    }
    h["Content-Length"]=end-start+1;
    res.writeHead(range?206:200,h);
    if(req.method==="HEAD"){res.end();return;}
    const stream=fs.createReadStream(target,{start,end});
    stream.on("error",()=>res.destroy());res.on("close",()=>stream.destroy());stream.pipe(res);
  });
}).listen(port,"127.0.0.1",()=>console.log("Firefall on http://localhost:"+port));
