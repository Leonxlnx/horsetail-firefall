import * as T from "three";

// A local light probe sees the actual sky and surrounding valley. The filtered
// angular footprint grows on weathered granite and shrinks on wet, polished rock.
export function lightingProbe(renderer,scene){
 const cube=new T.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,
   magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false});
 const probe=new T.CubeCamera(1.2,4200,cube);probe.position.set(180,265,92);
 probe.update(renderer,scene);return cube;
}
export const rockReflectance=`
uniform samplerCube valleyRadiance;
uniform sampler2D wetCourse;
uniform float reflectionReady,waterTop,waterFoot;
vec3 lineAtHeight(float h){
 return textureLod(wetCourse,vec2(clamp((waterTop-h)/(waterTop-waterFoot),0.,1.),.5),0.).xyz;
}
float ggxLight(vec3 n,vec3 v,vec3 l,float alpha,float f0,float angularRadius){
 vec3 h=normalize(v+l);float nv=max(.025,dot(n,v)),nl=max(.0,dot(n,l)),nh=max(0.,dot(n,h));
 float a=clamp(alpha+angularRadius*.58,.04,1.),aa=a*a;
 float den=nh*nh*(aa-1.)+1.,D=aa/(3.14159*den*den);
 float geomV=2.*nv/(nv+sqrt(aa+(1.-aa)*nv*nv));
 float geomL=2.*nl/max(.0001,nl+sqrt(aa+(1.-aa)*nl*nl));
 float F=f0+(1.-f0)*pow(1.-max(0.,dot(v,h)),5.);
 return D*F*geomV*geomL/(4.*nv);
}
vec3 weatheredRock(vec3 display,vec3 p,vec3 n,vec3 broad,float skyVisibility,float rakingSun,
                   float exposedSheet,float runoff,float crystalline,float sunlight,float isRed){
 if(reflectionReady<.5)return display;
 vec3 view=normalize(cameraPosition-p);
 vec3 core=lineAtHeight(p.y);
 float range=distance(p,core);
 float stain=exp(-pow(abs(p.x-core.x-2.8*(runoff-.5))/10.5,1.28));
 float wet=stain*(.25+.73*smoothstep(.30,.66,runoff))*(1.-smoothstep(waterTop-6.,waterTop+2.,p.y));
 wet+=.22*smoothstep(.61,.84,runoff)*(1.-exposedSheet);wet=clamp(wet,0.,.91);
 float rough=mix(.73-.13*exposedSheet,.15+.20*crystalline,wet);
 vec3 normal=normalize(mix(broad,n,.49+.40*rough)),reflected=reflect(-view,normal);
 vec3 environment=pow(textureLod(valleyRadiance,reflected,rough*rough*6.8).rgb,vec3(2.2));
 float nv=clamp(dot(normal,view),0.,1.);
 // Microscopic normal variation masks grazing reflections on a dry, rough sheet.
 float grazingF=mix(.37,1.,wet);
 float fresnel=.034+(grazingF-.034)*pow(1.-nv,5.);
 vec3 light=pow(max(vec3(.001),display),vec3(2.2))*(1.-.33*wet);
 light+=environment*fresnel*(.17+.72*wet+.12*exposedSheet)*(.53+.47*skyVisibility);
 vec3 amberColor=mix(vec3(1.,.325,.068),vec3(1.,.071,.024),isRed);
 vec3 towardSun=normalize(vec3(-.99,.123,.108));
 float direct=ggxLight(normal,view,towardSun,max(.036,rough*rough),.043,.0046);
 light+=amberColor*sunlight*min(1.2,direct*1.65)*rakingSun;
 if(range<63.&&p.y<waterTop+6.){
   float a=max(.055,rough*rough),shine=0.;
   for(int j=-1;j<=1;j++){
     float y=clamp(p.y+float(j)*(.5*range+4.),waterFoot,waterTop);
     vec3 delta=lineAtHeight(y)-p;float d=max(1.,length(delta));
     float angular=min(.49,3.1/d);
     shine+=ggxLight(normal,view,delta/d,a,.031,angular)*angular;
   }
   light+=amberColor*sunlight*min(.69,shine)*(.19+.93*wet);
 }
 return pow(max(vec3(.0),light),vec3(1./2.2));
}`;
