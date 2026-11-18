import * as T from "three";
import {rng,mix} from "./batholith.js";
import {U,quadVertex} from "./granite.js";
import {Ligaments} from "./ligaments.js";

// Both turbulence channels tile in three dimensions. The field is born in RAM,
// so two cameras can look through the same moving spray from opposite banks.
function turbulence(){
  const dim=72,rand=rng(93071),sizes=[5,9,18,36];
  const tables=sizes.map(n=>Float32Array.from({length:n*n*n*2},rand));
  const field=new Uint8Array(dim**3*2);
  for(let z=0;z<dim;z++)for(let y=0;y<dim;y++)for(let x=0;x<dim;x++){
    const k=2*(x+dim*(y+z*dim));let a=0,b=0;
    for(let o=0;o<4;o++){
      const n=sizes[o],table=tables[o],f=n/dim;
      const px=x*f,py=y*f,pz=z*f,ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);
      const fade=v=>v*v*(3-2*v),u=fade(px-ix),v=fade(py-iy),w=fade(pz-iz);
      for(let j=0;j<8;j++){
        const sx=j&1,sy=(j>>1)&1,sz=(j>>2)&1;
        const at=2*((ix+sx)%n+n*((iy+sy)%n+n*((iz+sz)%n)));
        const weight=(sx?u:1-u)*(sy?v:1-v)*(sz?w:1-w)*[.51,.28,.145,.065][o];
        a+=table[at]*weight;b+=table[at+1]*weight;
      }
    }
    field[k]=255*a;field[k+1]=255*b;
  }
  const tex=new T.Data3DTexture(field,dim,dim,dim);tex.format=T.RGFormat;tex.type=T.UnsignedByteType;
  tex.wrapS=tex.wrapT=tex.wrapR=T.RepeatWrapping;tex.minFilter=tex.magFilter=T.LinearFilter;tex.unpackAlignment=1;tex.needsUpdate=true;return tex;
}
export class FallingWater{
  constructor(renderer,course,lighting){
    this.renderer=renderer;this.scene=new T.Scene();this.camera=new T.Camera();
    const n=512,points=new Float32Array(n*4);
    for(let i=0;i<n;i++){
      const ix=i/(n-1)*(course.list.length-1),a=Math.floor(ix),b=Math.min(course.list.length-1,a+1);
      const p=course.list[a].clone().lerp(course.list[b],ix-a);
      points.set([p.x,p.y,p.z,1],i*4);
    }
    const path=new T.DataTexture(points,n,1,T.RGBAFormat,T.FloatType);path.minFilter=path.magFilter=T.LinearFilter;path.needsUpdate=true;
    this.u={...lighting,cloud:U(turbulence()),course:U(path),oldColor:U(null),oldDepth:U(null),eye:U(new T.Vector3()),
      invLens:U(new T.Matrix4()),camWorld:U(new T.Matrix4()),lip:U(course.lip),toe:U(course.hit),ledge:U(course.bench)};
    const mat=new T.ShaderMaterial({uniforms:this.u,vertexShader:quadVertex,fragmentShader:volume,depthTest:false,depthWrite:false});
    const screen=new T.Mesh(new T.PlaneGeometry(2,2),mat);screen.frustumCulled=false;this.scene.add(screen);
    this.fine=new Ligaments(this.u,course);
  }
  integrate(input,output,camera){
    this.u.oldColor.value=input.texture;this.u.oldDepth.value=input.depthTexture;
    this.u.eye.value.copy(camera.position);this.u.invLens.value.copy(camera.projectionMatrixInverse);this.u.camWorld.value.copy(camera.matrixWorld);
    this.renderer.setRenderTarget(output);this.renderer.render(this.scene,this.camera);
    this.fine.draw(this.renderer,camera,output);
  }
}
const volume=`
precision highp sampler3D;
varying vec2 st;uniform sampler3D cloud;uniform sampler2D course,oldColor,oldDepth;
uniform vec3 eye,lip,toe;uniform mat4 camWorld,invLens,sunVP;uniform sampler2D sunDepth;uniform float shadowsOn;
float penumbra(vec3 p){
 vec4 h=sunVP*vec4(p,1.);vec3 uv=h.xyz/h.w*.5+.5;
 if(shadowsOn<.5||min(uv.x,uv.y)<.002||max(uv.x,uv.y)>.998)return 1.;
 float v=uv.z-textureLod(sunDepth,uv.xy,0.).r;return 1.-smoothstep(.00017,.0010,v);
}
uniform float clockTime,day,amber,red,flow,ledge,dusk;
float bell(float x){return exp(-x*x);}
vec3 courseAt(float y){return textureLod(course,vec2(clamp((lip.y-y)/(lip.y-toe.y),0.,1.),.5),0.).rgb;}
vec2 sampleWind(vec3 p){return textureLod(cloud,p,0.).rg-.5;}
void main(){
  vec3 background=texture2D(oldColor,st).rgb;
  vec4 h=invLens*vec4(st*2.-1.,texture2D(oldDepth,st).r*2.-1.,1.);
  vec3 opaque=(camWorld*vec4(h.xyz/h.w,1.)).xyz;
  vec3 ray=normalize(opaque-eye);float farDepth=length(opaque-eye);
  vec3 low=vec3(toe.x-32.,toe.y-9.,min(lip.z,toe.z)-19.),high=vec3(lip.x+154.,lip.y+19.,max(lip.z,toe.z)+187.);
  vec3 t0=(low-eye)/ray,t1=(high-eye)/ray,lo=min(t0,t1),hi=max(t0,t1);
  float enter=max(0.,max(lo.x,max(lo.y,lo.z))),exitAt=min(farDepth,min(hi.x,min(hi.y,hi.z)));
  if(exitAt<=enter){gl_FragColor=vec4(background,1.);return;}
  vec3 mid=eye+ray*((enter+exitAt)*.5),c=courseAt(mid.y);
  float tail=clamp(mid.x-c.x,0.,154.);
  if(abs(ray.z)>.43){
    float za=(c.z-21.-tail*.23-eye.z)/ray.z,zb=(c.z+40.+tail*1.22-eye.z)/ray.z;
    enter=max(enter,min(za,zb));exitAt=min(exitAt,max(za,zb));
  }
  if(exitAt<=enter){gl_FragColor=vec4(background,1.);return;}
  float ds=(exitAt-enter)/64.,dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
  float trans=1.;vec3 lit=vec3(0.);vec2 refractOffset=vec2(0.);
  for(int i=0;i<64;i++){
    vec3 p=eye+ray*(enter+(float(i)+.2+.58*dither)*ds);
    float y=p.y,drop=max(0.,lip.y-y),range=lip.y-toe.y,d=drop/range;
    vec3 axis=courseAt(y);float x=p.x-axis.x,z=p.z-axis.z;
    float fallAge=(sqrt(20.25+19.62*drop)-4.5)/9.81;
    if(y<ledge)fallAge=(sqrt(20.25+19.62*(lip.y-ledge))-4.5)/9.81+(sqrt(29.16+19.62*(ledge-y))-5.4)/9.81;
    float adv=fallAge-clockTime;
    float first=clamp(drop/(lip.y-ledge),0.,1.),second=clamp((ledge-y)/(ledge-toe.y),0.,1.);
    float separate=smoothstep(-2.,19.,ledge-y),radius=mix((1.66+6.73*sqrt(first))*(1.06-.28*first),1.02+2.02*sqrt(second),separate);
    float hy=1.-smoothstep(lip.y-.2,lip.y+1.6,y);
    float floorFade=smoothstep(toe.y-2.,toe.y+.7,y);
    vec2 major=sampleWind(vec3(y*.0032,adv*.089,.32))*2.1;
    vec2 creases=sampleWind(vec3(x*.061+adv*.031,adv*.35,z*.063)+vec3(.17,.39,.61))*1.75;
    float meander=9.4*major.x+2.1*sin(y*.035+major.y*3.+adv*.14);
    float u=(x-meander*smoothstep(0.,18.,drop))/radius;
    float center=2.8*major.y+.85*sin(y*.067+adv*.87)+creases.r*1.72;
    float depth=z-center;
    float wav=sampleWind(vec3(u*.15,adv*.37,depth*.093)+major.x*.09).r;
    float braidA=(u+.18+1.18*major.x+.67*creases.y)*2.79,braidB=(u-.49+.93*major.y+wav*1.43)*4.8;
    float folded=bell((u+.02+.40*major.y+.22*creases.x)*1.1);
    float strand=bell(braidA)*(.93+.88*wav)+bell(braidB)*(.32+.68*creases.x)
      +folded*(.14+.35*smoothstep(-.22,.25,creases.y+wav))*(1.-.78*separate)*(1.-.80*smoothstep(.37,.88,first));
    float filaments=sampleWind(vec3(u*.65+creases.x*.09,adv*.78,depth*.13)).g;
    float sheet=bell((depth-.99*sin(u*3.9+major.x*6.2))/(.97+radius*.29));
    float core=max(0.,strand)*sheet*(.19+1.39*smoothstep(-.17,.28,creases.x+filaments*1.28))*1.04*hy*floorFade;
    // In the lee of the falling sheet the air entrains water. Two separate
    // impacts release broad fans which lift, drift and become optically thin.
    float wind=max(0.,x),wx=x-clockTime*1.45;
    vec3 fp=vec3(wx*.0053,y*.0055+clockTime*.0041,z*.0064);
    vec2 ed=sampleWind(fp),curl=sampleWind(fp*3.09+vec3(ed.y,ed.x,ed.y)*.74);
    vec2 ruffle=sampleWind(fp*6.3+vec3(curl.y,ed.x,curl.x)*.53);
    vec3 slip=vec3((x*.65+y*.76)*.003-clockTime*.012,(y-.83*x)*.019+clockTime*.007,(z-.72*x)*.012);
    vec2 folds=sampleWind(slip+vec3(ed.x,curl.y,ed.y)*.31);
    float tendril=sampleWind(slip*3.03+folds.r*.47).r;
    float lift=ed.x*39.+curl.y*17.+ruffle.y*6.7;
    float haze=bell((x-3.-.42*lift)/(4.8+7.*sqrt(max(d,0.))))*bell((z-1.-ed.y*4.8)/(3.7+.14*wind));
    float lee=bell((x-12.-lift)/(10.5+8.*d))*bell((z-3.-wind*.12)/(5.1+.17*wind));
    float roll=sin(wind*.078+clockTime*.14+ed.y*5.)*(2.8+wind*.065);
    float release=y-ledge-wind*.87-lift-roll-6.4*folds.y;
    float burst=bell(release/(4.1+.22*wind))*.48+bell((release-11.-.12*wind)/(8.5+.32*wind))*.181
               +bell((y-toe.y-2.1-wind*.57-lift*.51)/(2.8+.21*wind))*.151
               +bell((y-lip.y+3.-wind*.14-lift*.33)/(2.1+.14*wind))*.061;
    // Wind wraps the spray around the projecting eastern buttress.
    float wrap=3.+wind*.92+ed.y*7.+ruffle.r*3.;
    float lamella=exp(-abs(release+2.7+wind*.12+7.*folds.y)/(1.35+.058*wind))
       +.79*exp(-abs(release-3.2-wind*.16+8.3*curl.y)/(1.63+.074*wind));
    burst=.76*burst+.29*lamella*(.39+.61*smoothstep(-.22,.19,folds.r+tendril));
    burst*= (.49+1.17*smoothstep(-.20,.17,folds.x+tendril*.62))*exp(-wind/23.)*smoothstep(-7.,2.,x)*bell((z-wrap)/(5.4+.24*wind));
    float turbulent=smoothstep(-.185,.20,ed.x*.49+curl.r*.59+ruffle.y*.41);
    float veil=.018*bell((x-16.-lift)/18.)*bell((z-5.-wind*.56)/(5.1+.24*wind));
    float mist=(.047*haze+.030*lee+veil*.54)*mix(.60,1.,smoothstep(toe.y+10.,toe.y+63.,y))*mix(.33,1.,smoothstep(toe.y+8.,ledge-8.,y))*hy*floorFade*(.20+.80*turbulent)+burst*(.075+.70*turbulent)*.55;
    vec2 sprayXZ=vec2(p.x-toe.x,p.z-toe.z-.63);float rb=length(sprayXZ*vec2(.86,1.14));
    float fanHeight=toe.y+.02+.78*rb-.054*rb*rb+1.1*ruffle.g;
    float angle=atan(sprayXZ.y+.001,sprayXZ.x);
    float jets=.09+.83*pow(max(0.,cos(angle*3.+.65+ruffle.r*4.)),3.)+.23*pow(max(0.,cos(angle*5.-1.1)),3.);
    float fan=bell((y-fanHeight)/(.48+.085*rb))*(1.-smoothstep(3.,15.,rb))*jets;
    float spume=bell((p.y-toe.y-.45)/2.7)*bell(rb/6.1);
    mist+=(fan*.27+spume*.047)*(.46+.54*turbulent);
    float thinCore=bell(x/(1.46+radius))*bell(depth/3.2)*hy*floorFade*.053;
    float shredded=smoothstep(-.28,.29,filaments+creases.y*.62);
    core*=mix(.52,1.3,shredded)*mix(.67,1.,smoothstep(toe.y+4.,ledge-18.,y));
    float k=(core+mist*(1.+.29*red)+thinCore)*flow;
    float absorb=1.-exp(-k*ds);if(absorb<.00015)continue;
    float liquid=core/max(.0001,core+mist+thinCore),side=smoothstep(-.9,.86,-u+.62*creases.x);
    float bright=clamp(.064+.47*side+.34*min(1.2,strand)+filaments*.51,0.,1.);
    vec3 cold=mix(vec3(.32,.43,.55),vec3(.82,.88,.92),.22+.72*bright)*mix(1.,.56,dusk);
    float frontEdge=clamp(.50+(ed.x-sampleWind(fp+vec3(-.029,.004,.005)).x)*3.3,0.,1.);
    vec3 spray=mix(vec3(.57,.252,.163),vec3(1.04,.53,.265),.20+turbulent*.37+folds.x*.34+.27*frontEdge);
    spray=mix(spray,vec3(.44,.37,.34),.17*(1.-turbulent));
    vec3 gold=mix(vec3(1.02,.36,.063),vec3(1.35,1.03,.43),bright);
    gold*=mix(vec3(.95,.77,.69),vec3(1.),smoothstep(toe.y+9.,toe.y+71.,y));
    vec3 ruby=mix(vec3(.95,.066,.064),vec3(1.39,.69,.255),bright);
    spray=mix(spray,vec3(1.10,.76,.39),clamp(fan*.68+spume*.53,0.,.67));vec3 warm=mix(mix(spray,vec3(1.01,.133,.165),red*.72),mix(gold,ruby,red),liquid);
    warm*=mix(1.,.77+.23*sqrt(shredded),liquid);float light=amber*(.91+.09*smoothstep(-5.,6.,z+.25*x));
    light*=mix(1.,.15+.85*smoothstep(.58,1.,1.-d),dusk);
    float solar=penumbra(p),sunThrough=exp(-.49*max(0.,u+.68)*sheet);
    warm*=mix(.88,1.055,solar)*mix(1.,.94+.14*sunThrough,liquid);
    vec3 radiance=mix(cold,warm,light);
    refractOffset+=trans*absorb*liquid*vec2(creases.x+side-.55,major.y*.22);
    lit+=trans*absorb*radiance*radiance;trans*=1.-absorb;
    if(trans<.012)break;
  }
  vec2 px=1./vec2(textureSize(oldColor,0));
  vec3 displaced=textureLod(oldColor,clamp(st+refractOffset*px*4.3,.0001,.9999),0.).rgb;
  gl_FragColor=vec4(sqrt(displaced*displaced*trans+lit),1.);
}`;
