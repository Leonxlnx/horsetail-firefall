import * as T from "three";
import {crest,front,ground,summit,grid,makeCourse,mix,step} from "./batholith.js";
import {bakeGranite,U,quadVertex,wallVertex,cliffFragment,stoneNoise} from "./granite.js";
import {detachedGranite} from "./outcrops.js";
import {winterBoughs} from "./boughs.js";
import {growForest} from "./conifers.js";
import {valleyFloor} from "./talus.js";
import {FallingWater} from "./spray.js";
import {Lens} from "./optics.js";
import {shadowUniforms,bakeShadows} from "./skylight.js";
import {fractureField} from "./fractures.js";
import {lightingProbe} from "./reflectance.js";
import {crystalField} from "./crystals.js";
import {shots,shotAt} from "./timeline.js";
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const cameraTracks=[
 [[-6,37,1840,-2,254,-3,15.75],[4,39,1809,3,251,-5,15.64]],
 [[-24,33,790,-11,250,-3,37.0],[-22.5,33.4,788.2,-5,249,-5,36.7]],
 [[228,475,369,184,430,-20,17.8],[235,472,362,190,425,-20,17.6]],
 [[228,266,312,227,244,7,20.7],[234,260,305,224,230,7,20.9]],
 [[162,114,276,192,130,34,18.3],[169,111,267,193,123,34,18.0]],
 [[-24,9.0,704,-8,145,5,49.3],[-18,8.2,701,-3,145,3,48.8]],
 [[17,41,1766,-1,255,-3,16.1],[-1,37,1837,-5,253,-2,15.8]]
];
const poster=[228,474,369,184,427,-20,17.8];
function surface(w,h,depth){
 const target=new T.WebGLRenderTarget(w,h,{depthBuffer:depth,stencilBuffer:false});
 if(depth)target.depthTexture=new T.DepthTexture(w,h,T.UnsignedIntType);return target;
}
export class Firefall{
 constructor(canvas,capture){
   this.renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:"low-power",preserveDrawingBuffer:capture});
   this.renderer.setPixelRatio(1);this.capture=capture;this.scene=new T.Scene();
   this.cam=new T.PerspectiveCamera(25,1,.4,4900);this.mirrorCam=this.cam.clone();
   this.lens=new Lens(this.renderer);this.composite=surface(2,2,false);
   this.mirror=surface(704,396,true);this.mirrorColor=surface(704,396,false);this.mirrorColor.texture.generateMipmaps=true;this.mirrorColor.texture.minFilter=T.LinearMipmapLinearFilter;this.size=[2,2];
   this.course=makeCourse();this.u={...shadowUniforms(),reflectionReady:U(0),valleyRadiance:U(null),wetCourse:U(null),waterTop:U(this.course.top),waterFoot:U(this.course.hit.y),day:U(0),dusk:U(0),amber:U(1),red:U(0),clockTime:U(0),flow:U(1),impact:U(this.course.hit)};
 }
 async init(onPreview){
   this.joints=fractureField(this.renderer);const stone=await bakeGranite(this.renderer,this.joints.texture);this.stone=stone;this.crystals=crystalField(this.renderer);this.u.crystals=U(this.crystals.texture);this.u.joints=U(this.joints.texture);
   const uniforms={...this.u,relief:U(stone.bed.texture),normalField:U(stone.normals.texture),skyField:U(stone.exposure.texture),waterHistory:U(stone.hydrology.texture),macroField:U(stone.base)};
   const rim=Float32Array.from({length:1003},(_,i)=>crest(mix(-692,692,i/1002)));
   const wall=grid(1003,409,(u,v,i)=>[mix(-692,692,u),mix(-22,rim[i],v),0]);
   const cliff=new T.Mesh(wall,new T.ShaderMaterial({uniforms,vertexShader:wallVertex,fragmentShader:cliffFragment}));cliff.frustumCulled=false;this.scene.add(cliff);
   const escarpment=detachedGranite(this.scene,uniforms);valleyFloor(this.scene,this.u,this.course,stone,escarpment.scree);
   this.sky();this.riverMesh();this.water=new FallingWater(this.renderer,this.course,this.u);this.credits();this.river.visible=false;this.u.wetCourse.value=this.water.u.course.value;
   if(onPreview){await onPreview(this);await new Promise(resolve=>setTimeout(resolve,20));}
   this.forest=await growForest(this.renderer,this.scene,this.u,this.course,escarpment.plants);
   for(const [i,x,z,h] of [[0,-340,539,48],[0,-321,561,41],[0,-301,576,39],[0,289,546,40],[0,310,555,44],[0,338,590,49],
    [0,-177,1007,67],[1,-192,1019,71],[0,-151,932,51],[0,189,1006,59],[1,206,1011,65],[0,167,939,43],
    [1,-88,708,34],[0,75,714,34],[0,123,9,24],[0,137,21,17],[0,140,17,13],[0,165,19,10],[0,227,23,9],[0,247,41,12],[0,-146,523,66],[0,-139,515,58],[1,-131,511,43],[0,68,598,58],[0,102,532,50],[1,134,520,44]]){
      this.forest.hero(i,x,ground(x,z)-.31,z,h,x*.139);
   }
   this.boughs=winterBoughs(this.scene,this.u);
   this.shadowMaps=bakeShadows(this.renderer,this.scene,this.u,this.course.hit);
   this.lightProbe=lightingProbe(this.renderer,this.scene);this.u.valleyRadiance.value=this.lightProbe.texture;this.u.reflectionReady.value=1;
 }
 sky(){
   const mat=new T.ShaderMaterial({uniforms:this.u,side:T.BackSide,depthWrite:false,depthTest:false,
    vertexShader:`varying vec3 aim;void main(){aim=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader:`varying vec3 aim;uniform float day;${stoneNoise}
    void main(){vec3 d=normalize(aim);float h=clamp((d.y+.06)/.74,0.,1.);
    vec3 tw=mix(vec3(.620,.664,.816),vec3(.337,.447,.718),sqrt(h));vec3 noon=mix(vec3(.692,.795,.922),vec3(.377,.592,.858),sqrt(h));
    float cirrus=fb(d.xz*5.+d.xy*vec2(4.,17.))-.5;
    float west=dot(normalize(d.xz+vec2(.0001)),normalize(vec2(-.99,.11)))*.5+.5;
    float belt=exp(-pow((d.y-.055)/.087,2.))*(1.-day);
    tw=mix(tw,vec3(.61,.606,.744),belt*(.12+.13*(1.-west)));
    tw+=vec3(.080,.108,.150)*smoothstep(.035,.185,d.y);
    tw+=vec3(.035,.012,-.010)*west*exp(-max(0.,d.y)*5.);
    gl_FragColor=vec4(mix(tw,noon,day)+.027*cirrus,1.);}`});
   const m=new T.Mesh(new T.SphereGeometry(2200,24,12),mat);m.frustumCulled=false;m.renderOrder=-99;this.scene.add(m);
 }
 riverMesh(){
   this.refMatrix=U(new T.Matrix4());const mat=new T.ShaderMaterial({uniforms:{...this.u,mirrorMap:U(this.mirrorColor.texture),reflectVP:this.refMatrix,source0:U(this.course.hit),source1:U(this.course.lip)},
     vertexShader:`varying vec3 p;varying vec4 reflectUV;uniform mat4 reflectVP;void main(){p=(modelMatrix*vec4(position,1.)).xyz;reflectUV=reflectVP*vec4(p,1.);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
     fragmentShader:`varying vec3 p;varying vec4 reflectUV;uniform sampler2D mirrorMap;uniform vec3 source0,source1;uniform float clockTime,amber,red;${stoneNoise}
     void main(){vec2 uv=reflectUV.xy/reflectUV.w;float t=clockTime;
      float drift=fb(p.xz*.22+vec2(t*.09,-t*.20)),lines=.46*sin(p.z*3.8+p.x*.32+t*2.2+drift*6.)+.31*sin(p.z*6.1-p.x*.43+t*3.3+drift*8.)+.22*sin(p.z*10.4+p.x*.79-t*3.9);
      float chop=fb(p.xz*vec2(.21,.81)+vec2(drift+t*.07,-t*.27));
      vec2 offset=vec2((drift-.5)*.017+(chop-.5)*.012,lines*.0075+(fb(p.xz*.081-t*.027)-.5)*.052+(chop-.5)*.023);
      float rough=.82+.89*chop;
      vec3 refl=textureLod(mirrorMap,clamp(uv+offset,.001,.999),rough).rgb;
      refl=.65*refl+.18*textureLod(mirrorMap,clamp(uv+offset+vec2(.002,.009),.001,.999),rough+.6).rgb+.17*textureLod(mirrorMap,clamp(uv+offset-vec2(.002,.008),.001,.999),rough+.6).rgb;
      float f=pow(1.-max(.0,normalize(cameraPosition-p).y),4.);
      vec3 c=mix(vec3(.071,.126,.169),refl*vec3(.76,.83,.90),.61+.34*f);
      c+=vec3(.022,.032,.044)*(lines*.46+drift);
      vec3 v=normalize(cameraPosition-p);
      vec2 q=p.xz+3.9*vec2(vn(p.xz*.067+t*.015),vn(p.xz*.081+41.));
      float warp1=fb(q*vec2(.27,.64)+vec2(t*.04,t*.12)),warp2=vn(q*vec2(.62,.38)+7.);
      float s1=sin(dot(q,vec2(.60,3.5))+t*2.7+warp1*8.),s2=sin(dot(q,vec2(-.45,5.8))+t*3.5+warp2*7.);
      float breakup=vn(q*vec2(.27,1.4)+vec2(t*.08,t*.11)+warp2*1.7);
      float nearDetail=1.-smoothstep(.13,1.25,fwidth(q.y));
      vec2 micro=vec2(.006*(s1-s2)+.019*(vn(p.xz*.56+t*.19)-.5),
         .040*s1+.024*s2+nearDetail*.018*sin(q.y*14.5+q.x*1.5+t*5.5));
      float streak=0.;
      for(int j=0;j<5;j++){
        vec3 em=mix(source0,source1,(float(j)+.20)/5.);vec3 l=normalize(em-p);
        vec3 h=normalize(v+l);vec2 slopes=h.xz/max(.04,h.y);
        float cross=dot(normalize(l.xz),normalize(v.xz));vec2 error=slopes+micro;
        float r1=.012+.0025*float(j),r2=.148+.031*float(j);
        float phi=dot(vec2(-l.z,l.x),error)/r1,theta=dot(l.xz,error)/r2;
        streak+=exp(-phi*phi*.5-theta*theta*.5)*(1.-smoothstep(-.98,-.8,cross))*(.32-.015*float(j));
      }
      float broken=.10+.90*smoothstep(-.83,.85,s1*.72+s2*.41+drift-.47);
      c+=mix(vec3(1.,.46,.19),vec3(.90,.22,.11),red)*amber*min(.86,streak*broken*(.23+1.32*breakup));
      gl_FragColor=vec4(c,1.);}`});
   this.river=new T.Mesh(new T.PlaneGeometry(1950,480),mat);this.river.rotation.x=-Math.PI/2;this.river.position.set(0,1.35,660);this.scene.add(this.river);
 }
 reflect(){
   const cam=this.cam,m=this.mirrorCam,planeY=this.river.position.y;
   const aim=cam.position.clone().add(cam.getWorldDirection(V()));aim.y=2*planeY-aim.y;
   m.position.copy(cam.position);m.position.y=2*planeY-m.position.y;
   m.up.set(0,1,0).applyQuaternion(cam.quaternion);m.up.y*=-1;m.lookAt(aim);
   m.projectionMatrix.copy(cam.projectionMatrix);m.updateMatrixWorld();
   this.refMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);
   const plane=new T.Plane(V(0,1,0),-planeY).applyMatrix4(m.matrixWorldInverse),n=new T.Vector4(...plane.normal.toArray(),plane.constant),a=m.projectionMatrix.elements;
   const q=new T.Vector4((Math.sign(n.x)+a[8])/a[0],(Math.sign(n.y)+a[9])/a[5],-1,(1+a[10])/a[14]);
   n.multiplyScalar(2/n.dot(q));a[2]=n.x;a[6]=n.y;a[10]=n.z+1-.001;a[14]=n.w;m.projectionMatrixInverse.copy(m.projectionMatrix).invert();
   this.river.visible=false;this.renderer.setRenderTarget(this.mirror);this.renderer.render(this.scene,m);
   this.water.integrate(this.mirror,this.mirrorColor,m);this.river.visible=true;
 }
 credits(){
   const canvas=document.createElement("canvas");canvas.width=960;canvas.height=140;
   const c=canvas.getContext("2d");c.shadowColor="#0a1019";c.shadowBlur=4;c.fillStyle="#f4efe7";
   c.font="16px Arial";c.fillText("M U S I C",4,23);c.font="36px Georgia";c.fillText("Passage of Time   ·   Scott Buckley",4,71);
   c.font="17px Arial";c.fillText("Edited excerpt   ·   CC BY 4.0   ·   scottbuckley.com.au",4,110);
   this.ink={card:U(new T.CanvasTexture(canvas)),show:U(0),fade:U(0)};
   const m=new T.ShaderMaterial({uniforms:this.ink,vertexShader:quadVertex,transparent:true,depthWrite:false,depthTest:false,
    fragmentShader:`varying vec2 st;uniform sampler2D card;uniform float show,fade;void main(){vec2 uv=(st-vec2(.043,.066))/vec2(.50,.14);vec4 c=texture2D(card,clamp(uv,0.,1.));float a=c.a*show*step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
    float alpha=fade+(1.-fade)*a;gl_FragColor=vec4(c.rgb*a*(1.-fade)/max(alpha,.0001),alpha);}`});
   this.overlay=new T.Scene();const quad=new T.Mesh(new T.PlaneGeometry(2,2),m);quad.frustumCulled=false;this.overlay.add(quad);
 }
 resize(w,h){if(w===this.size[0]&&h===this.size[1])return;this.size=[w,h];this.renderer.setSize(w,h,false);this.lens.resize(w,h);this.composite.setSize(w,h);}
 async prepare(){}
 async expose(t){
   const [w,h]=this.size;
   if(!this.exposures)this.exposures=[surface(w,h,false),surface(w,h,false)];
   for(const view of this.exposures)if(view.width!==w||view.height!==h)view.setSize(w,h);
   const shot=shotAt(t);
   for(let i=0;i<2;i++){
     // Two points in a 180-degree shutter, with a rotated subpixel sampling grid.
     const tm=Math.min(shot.end-.00001,Math.max(shot.start,t+(i-.5)/96));
     await this.draw(tm,{jitter:i?[-.27,.22]:[.27,-.22],target:this.exposures[i]});
   }
   this.lens.u.second.value=this.exposures[1].texture;
   this.lens.pass(this.lens.average,this.exposures[0],null);
 }
 async draw(time,opts={}){
   const i=shots.indexOf(shotAt(time)),shot=shots[i],keys=cameraTracks[i];
   const f=step(0,1,(time-shot.start)/(shot.end-shot.start)),a=opts.cover?poster:keys[0].map((v,j)=>mix(v,keys[1][j],f));
   const cam=this.cam,aspect=this.size[0]/this.size[1],portrait=1-step(.68,1.54,aspect);
   cam.position.set(a[0]+(opts.x||0)*14,a[1]+(opts.y||0)*6,a[2]);
   cam.aspect=aspect;cam.fov=a[6]*(aspect>1.9?Math.max(.80,1.84/aspect):1);cam.lookAt(mix(a[3],i===2||opts.cover?232:216,portrait*.93),a[4],a[5]);if(!opts.cover)cam.rotateZ(i===3?.030:i===4?.021:0.);cam.updateProjectionMatrix();
   if(opts.jitter){
     cam.projectionMatrix.elements[8]+=opts.jitter[0]*2/this.size[0];cam.projectionMatrix.elements[9]+=opts.jitter[1]*2/this.size[1];
     cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
   }
   cam.updateMatrixWorld();
   this.u.day.value=opts.cover?0:1-step(.15,5.6,time);this.u.dusk.value=opts.cover?0:step(37.4,39.82,time);
   this.u.amber.value=opts.cover?1:step(1.8,6.85,time)*(1.-.93*this.u.dusk.value);
   this.u.red.value=opts.cover?0:step(33.8,36.1,time);this.u.flow.value=1.-.34*this.u.dusk.value;
   this.u.clockTime.value=time+17.6;this.boughs?.update(cam,this.size[1]);this.river.visible=!opts.cover&&i===5;if(this.river.visible)this.reflect();
   this.renderer.setRenderTarget(this.lens.frame);this.renderer.render(this.scene,cam);this.water.integrate(this.lens.frame,this.composite,cam);
   this.lens.u.dusk.value=this.u.dusk.value;this.lens.finish(time,this.u.amber.value,cam,this.composite,opts.target||null);
   if(!opts.cover&&time>35.8){this.ink.show.value=this.capture?step(35.8,36.6,time):0;this.ink.fade.value=step(39.30,39.96,time);
     this.renderer.autoClear=false;this.renderer.render(this.overlay,cam);this.renderer.autoClear=true;}
 }
}
