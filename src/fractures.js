import * as T from "three";
import {rng,noise} from "./batholith.js";

// Brittle fracture opens along persistent joints. Each stroke below has a broken
// tip, an open dark kerf and a bevel on the facing bank. The atlas is made on-site.
export function fractureField(renderer){
 const random=rng(492713),P=[],A=[],I=[];
 function fracture(x,y,length,angle,width,energy,phase,regime){
   const pieces=Math.max(4,Math.min(52,Math.floor(length/1.2)));
   const dx=Math.cos(angle),dy=Math.sin(angle),ox=-dy,oy=dx;
   const start=P.length/3,walk=length*(.015+.034*random()),pitch=.5+random()*1.3;
   for(let j=0;j<=pieces;j++){
     const t=j/pieces,local=t*length,ga=noise(local/3.8+phase,phase*.13,true);
     const kink=walk*(.72*noise(t*4.2+phase,pitch,true)+.38*noise(t*9.1+phase,2.1,true))+.13*ga;
     const centerX=x+local*dx+kink*ox,centerY=y+local*dy+kink*oy;
     const taper=Math.max(.08,Math.sin(Math.PI*t)**.4),wide=width*taper*(1.+.43*ga);
     const shade=energy*(.61+.39*taper)*(.82+.18*noise(t*5.9+phase,57));
     for(const u of [-1.3,-.34,.03,.26,1.05]){
       P.push((centerX+ox*u*wide+695)/1390*2-1,(centerY+oy*u*wide+28)/565*2-1,0);
       A.push(u,shade,regime);
     }
     if(j<pieces)for(let col=0;col<4;col++){
       const a=start+j*5+col;I.push(a,a+1,a+5,a+5,a+1,a+6);
     }
   }
 }
 for(let j=0;j<28200;j++){
   const x=-705+random()*1410,y=-30+random()*575,group=random();
   const regional=noise(x/105+61,y/117);
   const angle=group<.55?1.46+.30*regional+(random()-.5)*.26:group<.85?.56+.29*regional+(random()-.5)*.25:-.22+.28*regional+(random()-.5)*.4;
   const len=1.5+random()**3.4*(j<2200?96:33),phase=random()*416;
   const dense=.54+.38*noise(x/37,y/56);
   if(random()>dense)continue;
   fracture(x,y,len,angle,(.15+len*.021)*(.5+random()),.39+.56*random(),phase,group);
   if(len>14&&random()<.43){
     const at=.2+.56*random();
     fracture(x+Math.cos(angle)*len*at,y+Math.sin(angle)*len*at,len*(.19+.25*random()),angle+(random()>.5?1:-1)*(.14+.36*random()),.23+len*.006,.64,phase+1,group);
   }
 }
 // A few quartz-filled joints cross the dissolved dark fractures of the headwall.
 for(const [x,y,len,dip,width] of [[-251,135,54,.89,.51],[-148,240,42,1.08,.34],[-107,286,28,1.13,.33],
   [122,368,14,.47,.38],[143,416,23,1.42,.43],[176,401,17,.31,.26],
   [206,360,19,1.34,.27],[191,217,15,.50,.31],[164,127,21,.77,.38]]){
    fracture(x,y,len,dip,width,.85,random()*157,1.);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(P,3));geometry.setAttribute("mark",new T.Float32BufferAttribute(A,3));geometry.setIndex(I);
 const width=Math.min(5120,renderer.capabilities.maxTextureSize);
 const target=new T.WebGLRenderTarget(width,Math.round(width*2080/5120),{depthBuffer:false,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
 const material=new T.ShaderMaterial({transparent:true,blending:T.AdditiveBlending,side:T.DoubleSide,depthTest:false,depthWrite:false,forceSinglePass:true,
 vertexShader:"attribute vec3 mark;varying vec3 s;void main(){s=mark;gl_Position=vec4(position,1.);}",
 fragmentShader:`varying vec3 s;void main(){float u=s.x;
 float kerf=exp(-pow((u+.12)/.32,2.)),bevel=exp(-pow((u-.48)/.26,2.));
 float run=exp(-pow((u+.51)/.52,2.)),filled=smoothstep(.967,.992,s.z);
 gl_FragColor=vec4(kerf*(1.-filled),bevel*(1.-.6*filled),.06*run+filled*exp(-pow((u+.06)/.49,2.)),s.y);}`});
 const mesh=new T.Mesh(geometry,material),scene=new T.Scene();mesh.frustumCulled=false;scene.add(mesh);
 const clear=new T.Color();renderer.getClearColor(clear);const alpha=renderer.getClearAlpha();
 renderer.setClearColor(0,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,new T.Camera());
 renderer.setRenderTarget(null);renderer.setClearColor(clear,alpha);geometry.dispose();material.dispose();return target;
}
