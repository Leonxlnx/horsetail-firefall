import * as T from "three";
export function shadowUniforms(){
 return {shadowsOn:{value:0},farSky:{value:null},closeSky:{value:null},sunDepth:{value:null},sunVP:{value:new T.Matrix4()},farSkyVP:{value:new T.Matrix4()},closeSkyVP:{value:new T.Matrix4()}};
}
export function bakeShadows(renderer,scene,u,point){
 const maps=[];
 function bake(eye,aim,width,height,res,mat){
   const camera=new T.OrthographicCamera(-width/2,width/2,height/2,-height/2,1,2700);
   camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();
   mat.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
   const out=new T.WebGLRenderTarget(res,res,{depthBuffer:true});
   out.depthTexture=new T.DepthTexture(res,res,T.UnsignedIntType);
   renderer.setRenderTarget(out);renderer.render(scene,camera);maps.push(out);return out.depthTexture;
 }
 const a=new T.Vector3(-8,120,300);
 const b=bake(a.clone().add(new T.Vector3(-615,1270,480)),a,1730,1240,2048,u.farSkyVP.value);
 const c=bake(point.clone().add(new T.Vector3(-184,289,153)),point,235,188,1024,u.closeSkyVP.value);
 const focus=new T.Vector3(14,439,-30),sun=bake(focus.clone().add(new T.Vector3(-1250,154,135)),focus,805,470,2048,u.sunVP.value);
 renderer.setRenderTarget(null);u.sunDepth.value=sun;u.farSky.value=b;u.closeSky.value=c;u.shadowsOn.value=1;return maps;
}
export const shadowGL=`
uniform sampler2D farSky,closeSky,sunDepth;uniform mat4 farSkyVP,closeSkyVP,sunVP;uniform float shadowsOn;
float blocked(sampler2D field,mat4 vp,vec3 p,float size,float bias){
 vec4 h=vp*vec4(p,1.);vec3 q=h.xyz/h.w*.5+.5;
 if(min(q.x,q.y)<.004||max(q.x,q.y)>.996)return 0.;
 float delta=q.z-textureLod(field,q.xy,0.).r;
 float radius=size*(1.1+min(8.,max(0.,delta)*720.)),shade=0.;
 for(int i=0;i<9;i++){
   float angle=float(i)*2.399963,r=sqrt((float(i)+.25)/9.)*radius;
   float z=textureLod(field,q.xy+r*vec2(cos(angle),sin(angle)),0.).r;
   shade+=smoothstep(bias,bias*2.8,q.z-z);
 }return shade/9.;
}
float eveningSun(vec3 p){
 if(shadowsOn<.5)return 0.;
 return 1.-blocked(sunDepth,sunVP,p,.00049,.00020);
}
float skyShadow(vec3 p){
 if(shadowsOn<.5)return 1.;
 float a=blocked(farSky,farSkyVP,p,.00065,.00045);
 float b=blocked(closeSky,closeSkyVP,p,.00090,.00018);
 return (1.-.27*a)*(1.-.29*b);
}`;
