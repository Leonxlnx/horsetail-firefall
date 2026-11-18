import * as T from "three";
const quadVertex="varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}";
// Two metres through fresh granite reveal a quite different pattern from two
// metres down a weathered joint. This tile represents roughness on local tangent planes.
export function crystalField(renderer){
 const target=new T.WebGLRenderTarget(1280,1280,{depthBuffer:false,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
 target.texture.wrapS=target.texture.wrapT=T.RepeatWrapping;target.texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const mat=new T.ShaderMaterial({vertexShader:quadVertex,depthTest:false,depthWrite:false,fragmentShader:`
 varying vec2 st;
 float rand(vec2 a){vec3 p=fract(a.xyx*vec3(.1031,.0973,.1091));p+=dot(p,p.zyx+31.71);return fract((p.x+p.y)*p.z);}
 float noise(vec2 p,vec2 cells,float seed){
   vec2 x=p*cells,i=floor(x),f=fract(x);f=f*f*(3.-2.*f);vec2 k=vec2(seed,18.45+seed*.37);
   return mix(mix(rand(mod(i,cells)+k),rand(mod(i+vec2(1.,0.),cells)+k),f.x),
     mix(rand(mod(i+vec2(0.,1.),cells)+k),rand(mod(i+1.,cells)+k),f.x),f.y);
 }
 float split(vec2 uv,vec2 cells,float seed){
   vec2 p=uv*cells,i=floor(p),f=fract(p);vec2 s=vec2(seed,seed*1.67);
   float a=rand(mod(i,cells)+s),b=rand(mod(i+vec2(1.,0.),cells)+s),
     c=rand(mod(i+vec2(0.,1.),cells)+s),d=rand(mod(i+1.,cells)+s);
   return f.x+f.y<1.?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
 }
 vec3 materialAt(vec2 p){
   vec2 s=vec2(p.x-p.y,p.y),warp=vec2(noise(p,vec2(5.,6.),15.),noise(p,vec2(7.,4.),17.))-.5;
   vec2 bent=p+warp*.023;
   float coarse=noise(bent,vec2(7.,12.),7.),middle=noise(bent,vec2(22.,31.),29.);
   float chip=1.-abs(2.*noise(bent,vec2(61.,87.),39.)-1.);
   float lath=noise(s+warp*.008,vec2(97.,36.),74.),pits=noise(bent,vec2(165.,148.),23.);
   float mica=smoothstep(.70,.94,noise(bent,vec2(291.,268.),38.)+.14*(middle-.5));
   float quartz=smoothstep(.49,.81,lath+.30*(pits-.5)+.13*(coarse-.5));
   float facet=split(bent+warp*.014,vec2(21.,39.),68.),splinter=split(s+warp*.008,vec2(71.,95.),21.);
   float wound=abs(2.*split(bent,vec2(27.,49.),77.)-1.);
   float ridge=1.-smoothstep(.03,.28,wound);
   float vein=split(bent,vec2(119.,251.),94.);
   float relief=.59*(facet-.5)+.224*(splinter-.5)+.118*ridge+.054*vein+.74*coarse+.37*middle+.108*chip+.081*lath+.027*pits+.022*quartz-.025*mica;
   float value=.44+(coarse-.5)*.19+(middle-.5)*.27+(chip-.5)*.18+.28*quartz-.34*mica
      +.24*(facet-.5)+.21*(splinter-.5)+.13*(vein-.5)+.09*ridge;
   return vec3(relief,value,mica);
 }
 void main(){float e=1./1280.;vec3 mid=materialAt(st);
   float dx=(materialAt(st+vec2(e,0.)).x-materialAt(st-vec2(e,0.)).x)/(64.*e);
   float dy=(materialAt(st+vec2(0.,e)).x-materialAt(st-vec2(0.,e)).x)/(64.*e);
   gl_FragColor=vec4(clamp(vec2(dx,dy)*.37+.5,0.,1.),mid.y,mid.z);
 }`});
 const plane=new T.Mesh(new T.PlaneGeometry(2,2),mat);plane.frustumCulled=false;const scene=new T.Scene();scene.add(plane);
 renderer.setRenderTarget(target);renderer.render(scene,new T.Camera());renderer.setRenderTarget(null);plane.geometry.dispose();mat.dispose();return target;
}
export const crystalGL=`
uniform sampler2D crystals;
vec4 rotatedGrain(vec2 uv,vec2 key,vec2 dx,vec2 dy){
 float r=hash(key+301.7)*6.283185;
 mat2 rot=mat2(cos(r),sin(r),-sin(r),cos(r));
 vec2 offset=vec2(hash(key+37.6),hash(key+90.3));
 vec4 g=textureGrad(crystals,rot*uv+offset,rot*dx,rot*dy);
 g.rg=transpose(rot)*((g.rg-.5)/.37);return g;
}
vec4 stonePatch(vec2 uv,float tag){
 // Three adjoining sampling frames share a barycentric partition. Rotating
 // the sampled derivatives back keeps raking highlights fixed to the stone.
 vec2 dx=dFdx(uv),dy=dFdy(uv),p=uv*.65+tag;
 p=vec2(p.x-p.y*.57735,p.y*1.15470);
 vec2 id=floor(p),f=fract(p);float upper=step(1.,f.x+f.y);
 vec2 a=id+vec2(upper),b=id+vec2(1.,0.),c=id+vec2(0.,1.);
 vec3 weights=mix(vec3(1.-f.x-f.y,f.x,f.y),vec3(f.x+f.y-1.,1.-f.y,1.-f.x),upper);
 weights=max(vec3(.0),weights);weights*=weights;weights/=max(.001,weights.x+weights.y+weights.z);
 vec4 mixed=rotatedGrain(uv,a,dx,dy)*weights.x+rotatedGrain(uv,b,dx,dy)*weights.y+rotatedGrain(uv,c,dx,dy)*weights.z;
 float variance=min(1.57,inversesqrt(dot(weights,weights)));
 mixed.rg*=variance;mixed.b=.50+(mixed.b-.50)*variance;return mixed;
}
vec4 grainSurface(vec3 p,vec3 n){
 vec3 axis=pow(abs(n),vec3(4.));axis/=max(.001,axis.x+axis.y+axis.z);
 vec4 a=stonePatch(vec2(p.z*.90+p.y*.13,p.y)/32.,3.1);
 vec4 b=stonePatch(vec2(p.x-p.z*.21,p.z)/32.,7.6);
 vec4 c=stonePatch(vec2(p.x-p.y*.12,p.y)/32.,11.3);
 vec3 grad=axis.x*vec3(0.,a.r*.13+a.g,a.r*.90)+axis.y*vec3(b.r,0.,b.g-.21*b.r)+axis.z*vec3(c.r,c.g-.12*c.r,0.);
 vec3 T=normalize(cross(abs(n.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.),n)),B=cross(n,T);
 return vec4(vec2(dot(grad,T),dot(grad,B))*.37+.5,a.ba*axis.x+b.ba*axis.y+c.ba*axis.z);
}
vec3 grainNormal(vec3 n,vec4 grain,float amount){
 vec3 a=normalize(cross(abs(n.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.),n)),b=cross(n,a);
 vec2 g=(grain.rg-.5)/.37;
 return normalize(n-amount*(a*g.x+b*g.y));
}`;
