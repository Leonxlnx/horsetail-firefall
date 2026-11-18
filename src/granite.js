import * as T from "three";
import {front,crest,mix,exposureHistory} from "./batholith.js";
import {crystalGL} from "./crystals.js";
import {rockReflectance} from "./reflectance.js";
import {shadowGL} from "./skylight.js";
export const U=value=>({value});
export const quadVertex="varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}";
export const stoneNoise=`
float hash(vec2 p){vec3 a=fract(p.xyx*vec3(.1031,.0993,.0973));a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float triangular(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+1.);return f.x+f.y<1.?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);}
float fb(vec2 p){return vn(p)*.52+vn(mat2(.8,-.6,.6,.8)*p*2.07+18.)*.27+vn(p*4.13+48.)*.14+vn(p*8.41+13.)*.07;}
vec3 cells(vec2 p){
  vec2 ip=floor(p),f=fract(p);float a=10.,b=10.,tag=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 o=vec2(float(i),float(j)),g=ip+o;
    vec2 d=o+vec2(.12)+.76*vec2(hash(g+13.1),hash(g+51.8))-f;float v=dot(d,d);
    if(v<a){b=a;a=v;tag=hash(g+87.);}else b=min(b,v);
  }
  return vec3(sqrt(b)-sqrt(a),tag,sqrt(a));
}`;
const bounds=`vec2 atlasUV(vec2 p){return (p-vec2(-695.,-28.))/vec2(1390.,565.);}vec2 metres(vec2 uv){return uv*vec2(1390.,565.)+vec2(-695.,-28.);}`;
function target(w,h,half=false){
  return new T.WebGLRenderTarget(w,h,{type:half?T.HalfFloatType:T.UnsignedByteType,depthBuffer:false,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false});
}
export async function bakeGranite(renderer,faultTexture){
  const w=893,h=367,data=new Float32Array(w*h*4);
  const summits=Float32Array.from({length:w},(_,i)=>crest(mix(-695,695,i/(w-1))));
  for(let j=0;j<h;j++){
    const y=mix(-28,537,j/(h-1));
    for(let i=0;i<w;i++){
      const x=mix(-695,695,i/(w-1)),k=4*(i+j*w);
      data[k]=front(x,y,summits[i]);data[k+1]=summits[i];const surface=exposureHistory(x,y);data[k+2]=surface[0];data[k+3]=surface[1];
    }
    if(j%35===0)await new Promise(r=>setTimeout(r,0));
  }
  const base=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);
  base.magFilter=base.minFilter=T.LinearFilter;base.needsUpdate=true;
  const scene=new T.Scene(),camera=new T.Camera(),plane=new T.Mesh(new T.PlaneGeometry(2,2));plane.frustumCulled=false;scene.add(plane);
  const uniforms={base:U(base),bed:U(null),normalsIn:U(null),joints:U(faultTexture)};
  function bake(output,code){
    const mat=new T.ShaderMaterial({vertexShader:quadVertex,fragmentShader:"varying vec2 st;uniform sampler2D base,bed,joints,normalsIn;"+bounds+stoneNoise+code,uniforms,depthTest:false,depthWrite:false});
    plane.material=mat;renderer.setRenderTarget(output);renderer.render(scene,camera);mat.dispose();
  }
  const bed=target(3584,1472,true);
  bake(bed,`
    vec2 cleftBlock(vec2 p,float seed){
      vec2 cell=floor(p),f=fract(p),winner=vec2(0.),runner=vec2(0.),offset1=vec2(0.),offset2=vec2(0.);
      float one=100.,two=100.;
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
        vec2 o=vec2(float(i),float(j));vec2 key=cell+o+seed;
        vec2 to=o+vec2(.09)+.82*vec2(hash(key+1.2),hash(key+16.7))-f;float dist=dot(to,to);
        if(dist<one){two=one;runner=winner;offset2=offset1;one=dist;winner=key;offset1=to;}
        else if(dist<two){two=dist;runner=key;offset2=to;}
      }
      float edge=.5*(two-one)/max(.01,length(offset2-offset1));
      vec2 dip1=vec2(hash(winner+76.),hash(winner+131.))-.5,dip2=vec2(hash(runner+76.),hash(runner+131.))-.5;
      float here=(hash(winner+37.)-.5)*.53+dot(offset1,dip1)*2.18;
      float there=(hash(runner+37.)-.5)*.53+dot(offset2,dip2)*2.18;
      float bevel=mix(there,here,.5+.5*smoothstep(0.,.115,edge));
      return vec2(bevel,edge);
    }
    void main(){
      vec2 p=metres(st);
      vec4 macroSurface=texture2D(base,st);float z=macroSurface.r;
      vec2 w=vec2(fb(p/vec2(90.,112.)),fb(p/vec2(74.,126.)+47.))-.5;
      vec2 a=vec2(p.x-.135*p.y+.13*z,p.y+.10*p.x)+w*5.3;
      vec3 slab=cells(a/vec2(15.7,41.3)+17.);
      vec3 chip=cells(vec2(p.x+.32*p.y,p.y-.17*p.x)/vec2(5.6,11.8)+w*.32);
      float detached=smoothstep(.24,.85,fb(p/vec2(69.,96.)+23.));
      float tooth=slab.y*(1.-exp(-slab.x*20.));
      float mid=triangular(vec2(a.x/8.1,a.y/22.7)+37.);
      float hand=triangular(vec2(a.x/2.3,a.y/5.4)+17.);
      // Joints terminate or step over at the boundary of each local fracture domain.

      float faultDip=mix(.23,.83,vn(p/vec2(109.,143.)+47.));
      float shear=(p.y-faultDip*p.x)/24.7+1.21*fb(p/vec2(68.,46.))+.068*vn(p/4.8);
      float crack=exp(-abs(fract(shear+.5)-.5)*99.)*smoothstep(.51,.73,fb(p/vec2(24.,37.)+79.));
      float cleave=exp(-slab.x*53.)*smoothstep(.38,.86,slab.y)*smoothstep(.34,.64,fb(p/vec2(35.,51.)+26.));
      float wear=.20+.80*smoothstep(.22,.83,fb(p/36.+13.));
      z+=1.1*tooth*detached+(.65+detached)*4.3*(mid-.5)+1.57*(hand-.5)
         +.55*chip.y*(1.-exp(-chip.x*24.))*wear-.52*cleave-.32*crack;
      vec2 offset=vec2(fb(p/vec2(28.,33.)+64.),fb(p/vec2(35.,21.)+43.))-.5;
      vec2 plateAxis=vec2(p.x-.24*p.y+.15*z,p.y+.13*p.x)+w*8.3+offset*2.2;
      vec2 mass=cleftBlock(plateAxis/vec2(27.,57.),23.),flakes=cleftBlock((plateAxis+offset*1.3)/vec2(5.6,12.5),63.);
      vec2 splinters=cleftBlock((vec2(p.x+.25*p.y,p.y-.24*p.x)+offset*1.7)/vec2(1.63,3.74),94.);
      float intact=smoothstep(.22,.74,fb(p/vec2(33.,47.)+22.));
      vec3 joint=texture2D(joints,st).rgb;float open=joint.r*(.47+.53*wear);
      z+=((2.3+2.5*intact)*mass.x+(.77+1.22*intact)*flakes.x+.51*splinters.x)*(1.-.58*macroSurface.a)-.61*open+.28*joint.g;
      gl_FragColor=vec4(z,clamp(cleave+.24*crack+.58*open,0.,1.),slab.y,wear);
    }`);
  uniforms.bed.value=bed.texture;
  const normals=target(3584,1472);
  bake(normals,`void main(){
    vec2 delta=vec2(1./3584.,1./1472.);vec4 f=texture2D(bed,st);
    float dx=(texture2D(bed,st+vec2(delta.x,0.)).r-texture2D(bed,st-vec2(delta.x,0.)).r)/(2.*1390.*delta.x);
    float dy=(texture2D(bed,st+vec2(0.,delta.y)).r-texture2D(bed,st-vec2(0.,delta.y)).r)/(2.*565.*delta.y);
    vec3 n=normalize(vec3(-dx,-dy,1.));gl_FragColor=vec4(n.xy*.5+.5,f.g,f.b);
  }`);
  const exposure=target(1536,632);
  bake(exposure,`void main(){
    vec2 p=metres(st);float level=texture2D(bed,st).r,openness=0.,leftSky=0.,sun=1.;
    for(int i=0;i<10;i++){
      float ang=(float(i)+.15)*.6283185;vec2 dir=vec2(cos(ang),sin(ang));float horizon=-.20;
      for(int k=0;k<10;k++){
        float d=1.05*pow(1.76,float(k));vec2 xy=p+dir*d,uv=atlasUV(xy);
        float elev=textureLod(bed,uv,0.).r;float roof=textureLod(base,uv,0.).g;
        if(xy.y<roof)horizon=max(horizon,(elev-level-.24)/d);
      }
      float vis=1.-max(0.,atan(horizon))*.63662;
      openness+=vis*.1;leftSky+=vis*max(0.,dot(dir,normalize(vec2(-.74,.67))))*.304;
    }
    for(int k=0;k<34;k++){
      float d=1.4+float(k)*1.4+float(k*k)*.29;vec2 xy=p+vec2(-.993,.118)*d,uv=atlasUV(xy);
      float wall=textureLod(bed,uv,0.).r;float roof=textureLod(base,uv,0.).g;
      if(xy.y<roof)sun=min(sun,smoothstep(-.025,.021,(level+d*.102-wall+.21)/d));
    }
    gl_FragColor=vec4(openness,leftSky,sun,1.);
  }`);
  uniforms.normalsIn.value=normals.texture;
  const hydrology=target(2304,936);
  bake(hydrology,`
    float upstreamDrift(vec2 at){
      vec2 uv=atlasUV(at);vec2 n=textureLod(normalsIn,uv,0.).rg*2.-1.;
      return clamp(-n.x*n.y/max(.29,1.-n.y*n.y),-1.11,1.11);
    }
    void main(){
      vec2 point=metres(st),q=point;
      float accumulated=0.,mass=0.,jac=1.,distanceRun=0.;
      for(int j=0;j<22;j++){
        float d=1.64+.31*float(j),s=upstreamDrift(q);
        float rate=upstreamDrift(q+vec2(1.1,0.))-upstreamDrift(q-vec2(1.1,0.));
        jac*=clamp(1.+d*rate*.21,.72,1.28);
        jac=clamp(jac,.22,2.8);
        q+=vec2(s*d,d);distanceRun+=d;
        vec2 uv=atlasUV(q);vec4 n=textureLod(normalsIn,uv,0.);vec3 faults=textureLod(joints,uv,0.).rgb;
        float crown=textureLod(base,uv,0.).g;
        float supplies=smoothstep(.49,.73,fb(vec2(q.x*.14+q.y*.024,q.y*.057)+39.))*.28;
        supplies+=.48*pow(max(0.,n.g*2.-1.),2.)+.23*faults.r+.22*n.b;
        float weight=exp(-distanceRun*.017)*d;
        accumulated+=supplies*jac*weight;mass+=weight;
        if(q.y>crown){accumulated+=weight*(.15+.71*vn(q*.093))*jac;break;}
      }
      float flux=clamp(accumulated/max(.1,mass)*1.81,0.,1.);
      vec2 eps=vec2(1.3/1390.,1.3/565.);
      float mid=textureLod(bed,st,0.).r;
      float bowl=textureLod(bed,st+vec2(eps.x,0.),0.).r+textureLod(bed,st-vec2(eps.x,0.),0.).r+
                 textureLod(bed,st+vec2(0.,eps.y),0.).r+textureLod(bed,st-vec2(0.,eps.y),0.).r-4.*mid;
      float leach=vn(vec2(q.x*.27+q.y*.027,q.y*.020)+71.);
      gl_FragColor=vec4(flux,clamp(.5+bowl*.22,0.,1.),leach,clamp(.30+.29*jac,0.,1.));
    }`);
  renderer.setRenderTarget(null);plane.geometry.dispose();return {base,bed,normals,exposure,hydrology};
}
export const wallVertex=`
uniform sampler2D relief;varying vec3 world,normalW;varying vec2 mapUV;
${bounds}
void main(){world=position;mapUV=atlasUV(world.xy);world.z=texture2D(relief,mapUV).r;normalW=normal;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`;
export const worldVertex=`varying vec3 world,normalW;varying vec2 mapUV;${bounds}
void main(){world=(modelMatrix*vec4(position,1.)).xyz;normalW=mat3(modelMatrix)*normal;mapUV=atlasUV(world.xy);gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`;
export const commonLight=`
${shadowGL}
uniform float day,amber,red;uniform vec3 impact;
vec3 atmosphere(vec3 c,vec3 p){
  float a=exp(-max(-10.,cameraPosition.y)/96.),b=exp(-max(-10.,p.y)/96.);
  float vertical=(p.y-cameraPosition.y)/96.;
  float lowMist=abs(vertical)<.0008?.5*(a+b):(a-b)/vertical;
  float air=1.-exp(-length(cameraPosition-p)*(.000041+.00015*clamp(lowMist,0.,1.1)));
  return mix(c,mix(vec3(.165,.221,.341),vec3(.253,.364,.526),day),air);
}
vec3 sunColor(){return mix(vec3(1.,.54,.235),vec3(.81,.33,.16),red*.70)*(1.-.67*red);}
`;
export const cliffFragment=`
varying vec3 world,normalW;varying vec2 mapUV;
uniform sampler2D relief,normalField,skyField,macroField,joints,waterHistory;
${stoneNoise}${commonLight}${crystalGL}${rockReflectance}
// A finite hairline in each fracture domain. Pixel footprint controls both
// edge softness and peak contrast as individual openings become subpixel.
vec2 steppedFissures(vec2 q,float family){
  vec2 cell=floor(q),f=fract(q);float seed=hash(cell+family);
  float center=.17+.65*hash(cell+family+17.8);
  float along=f.y-(.23+.52*hash(cell+family+41.));
  float bend=along*(seed-.5)*.61+.047*triangular(vec2(along*8.1,seed*77.))+.015*triangular(q*vec2(3.,37.));
  float normal=f.x-center-bend,w=.018+.049*seed*seed;
  float pix=max(.0008,.52*(abs(dFdx(q.x))+abs(dFdy(q.x))));
  float ends=1.-smoothstep(.16+.12*seed,.24+.20*seed,abs(along));
  float opening=(1.-smoothstep(w-pix,w+pix,abs(normal)))*min(1.,w/pix);
  float lip=.46*w;float chipped=(1.-smoothstep(lip-pix,lip+pix,abs(normal-w*1.7)))*min(1.,lip/pix);
  return ends*vec2(opening,chipped)*(.42+.57*seed);
}
void main(){
  vec2 p=world.xy;vec4 field=texture2D(normalField,mapUV),ex=texture2D(skyField,mapUV);
  vec2 slope=field.rg*2.-1.;vec3 n=normalize(vec3(slope,sqrt(max(.0002,1.-dot(slope,slope)))));
  vec2 s=vec2(p.x-.13*p.y+.18*world.z,p.y+.11*p.x);
  vec4 drainage=texture2D(waterHistory,mapUV);
  float province=fb(s/vec2(115.,175.));
  float run=.43*fb(vec2(p.x*.119+1.13*vn(p/82.),p.y*.009)+23.)+.31*drainage.r+.26*drainage.b;
  float vein=triangular(s/vec2(1.8,4.9)+fb(p/33.)*.77);
  float mica=vn(s*3.8),speckle=vn(s*12.);
  vec2 slip=s+vec2(.31,-.15)*world.z;
  vec2 warp=vec2(fb(s/5.8+31.),fb(s/7.2+7.))-.5;
  float flake=triangular(slip/vec2(.87,2.3)+warp*.81);
  float shard=triangular(mat2(.86,-.51,.51,.86)*slip/vec2(.35,.94)+warp*.43);
  float ridge=abs(2.*vn(slip/vec2(.18,.42)+warp*.9)-1.);
  float reliefHeight=.46*flake+.19*shard+.071*ridge;
  vec4 crystal=grainSurface(world,n);vec3 substrate=n;vec3 fault=texture2D(joints,mapUV).rgb;
  float localPlanes=triangular((s+warp*1.62)/vec2(2.7,6.8)+11.);
  float weathered=fb(vec2(p.x*.47+.36*vn(p/5.),p.y*.11)+world.z*.07);
  float sediment=fb(p/vec2(8.,23.)+world.z*.031);
  float openFace=smoothstep(.38,.66,sediment+.21*(vein-.5));
  vec4 history=texture2D(macroField,mapUV);float damage=smoothstep(.37,.64,fb(s/vec2(14.,29.)+26.)*.66+fb(s/vec2(32.,55.)+13.)*.34+.12*fault.r);
  damage=clamp(damage*.74+max(0.,.51-drainage.g)*.50,0.,1.);damage*=(1.-.65*history.a)*(.72+.28*smoothstep(55.,160.,p.x));n=grainNormal(n,crystal,.26+.64*damage);
  float wash=smoothstep(.27,.73,province+.24*(run-.5));
  float varnish=fb(vec2(s.x*.33+fb(s/18.)*1.6,s.y*.025)+17.);
  float waterVarnish=smoothstep(.28,.74,drainage.r+.32*(drainage.b-.5));
  float albedo=(1.-.22*waterVarnish)*(.85+.30*wash)*(.86+.29*run)*(.84+.29*vein)*(.90+.18*mica)*(.88+.24*varnish);
  // Resolve the strike of the parent joint over nine metres before adding
  // small crystal facets. Shelf planes retain a coherent skylight exposure.
  vec2 scale=vec2(1./1390.,1./565.);
  float sx=(texture2D(macroField,mapUV+vec2(scale.x*1.45,0.)).r-texture2D(macroField,mapUV-vec2(scale.x*1.45,0.)).r)/2.90;
  float sy=(texture2D(macroField,mapUV+vec2(0.,scale.y*1.45)).r-texture2D(macroField,mapUV-vec2(0.,scale.y*1.45)).r)/2.90;
  vec3 parentFace=normalize(vec3(-sx,-sy,1.));
  vec3 skyFace=normalize(mix(n,parentFace,.56+.17*history.a));
  float sky=.14+.72*max(0.,dot(skyFace,normalize(vec3(-.78,.55,.31))))+.16*max(0.,skyFace.y)+.11*skyFace.z;
  float ao=.24+.76*pow(ex.r,1.55);float skylight=sky*ao*(.87+.27*ex.g);
  float pale=exp(-pow(abs(p.x+258.-.68*(p.y-122.))/37.,2.))*smoothstep(105.,197.,p.y)*(1.-smoothstep(363.,452.,p.y));
  float summit=smoothstep(343.,430.,p.y),warmBank=summit*exp(-pow(abs(p.x-193.)/76.,2.));
  float seamWash=fb(vec2(p.x*.057+p.y*.004,p.y*.004)+vec2(0.,6.))+(.5-run)*.16;
  float stained=smoothstep(.42,.70,seamWash);
  vec3 base=mix(vec3(.165,.198,.244),vec3(.277,.305,.339),wash)*albedo;
  base=mix(base,base*vec3(.68,.55,.46),stained*.58);
  float leeSide=smoothstep(208.,286.,p.x)*(.62+.38*fb(p/34.));
  base*=1.-.37*leeSide;
  base=mix(base,base*vec3(1.34,1.15,.97),warmBank*.70);
  float scarFade=1.-.55*smoothstep(319.,429.,p.y);
  float xenolith=fb(vec2((p.x-.63*p.y)*.089,p.y*.016)+vec2(23.,73.));
  float exhumed=history.b*scarFade*(.64+.36*smoothstep(.32,.67,xenolith));
  float patina=fb(vec2((p.x-.65*p.y)*.18,p.y*.016)+world.z*.03);
  base*=.89+.15*smoothstep(56.,220.,p.y)+.085*pale;
  float polish=fb(vec2((p.x-.68*p.y)*.72+vn(p/21.)*.9,p.y*.033)+63.);
  vec3 fresh=mix(vec3(.246,.276,.321),vec3(.35,.365,.380),patina)*(.86+.27*polish);
  fresh=mix(fresh,fresh*vec3(1.14,1.01,.83),smoothstep(.64,.84,polish)*.53);
  base=mix(base,fresh,exhumed*.74);
  base=mix(base,base*vec3(.84,.88,.93),max(0.,history.a-exhumed)*.50);
  vec3 color=base*(.51+.88*skylight)*(.94+.34*day)*(1.-.35*field.b);
  color*=.65+.48*crystal.b+.16*flake+.10*shard+.22*localPlanes;
  color*=mix(.86,1.16,openFace)*(.83+.34*weathered);
  color*=1.-.54*fault.r;
  float catchment=smoothstep(.46,.75,run+.31*(drainage.r-.5));
  float stripe=fb(vec2(p.x*.21+.69*vn(p/39.),p.y*.007)+53.);
  color*=mix(vec3(1.),vec3(.71,.69,.69),catchment*smoothstep(.42,.71,stripe)*(.4+.6*(1.-history.b)));
  float quartzSeam=smoothstep(.08,.68,fault.b);
  color=mix(color,vec3(.34,.36,.39)*(.58+.55*skylight)*(.89+.18*flake),quartzSeam*.67);
  color+=vec3(.071,.081,.100)*fault.g*(.55+1.25*ex.r);
  color=mix(color,color*vec3(.84,.97,1.15),.56*(1.-stained));
  float gulch=smoothstep(109.,219.,p.x)*(1.-smoothstep(145.,274.,p.y));
  color*=mix(vec3(1.),vec3(.43,.49,.55),gulch);
  float copper=smoothstep(178.,218.,p.x)*(1.-smoothstep(267.,302.,p.x))*smoothstep(172.,230.,p.y);
  float frosty=(1.-copper)*(.60+.40*smoothstep(180.,330.,p.y));
  color*=mix(vec3(1.06,1.01,.93),vec3(1.04,1.18,1.29),frosty);
  float lipDetail=smoothstep(345.,410.,p.y)*exp(-pow((p.x-184.)/97.,2.));
  color=color*(1.+.16*lipDetail)+lipDetail*((vein-.5)*.044+(crystal.b-.5)*.073);
  color+=vec3(.007,.010,.018)*ex.r;
  float gorge=exp(-pow((p.x-193.)/91.,2.))*(.71+.29*(1.-smoothstep(229.,386.,p.y)));
  color*=mix(vec3(1.),vec3(.79,.71,.65),gorge);
  color*=1.+(crystal.b-.53)*(.31+damage*.91);
  color*=1.-.32*crystal.a*(.35+.65*damage);
  color+=vec3(.086,.093,.103)*(crystal.b-.52)*(.20+.80*damage)*(.60+.40*ex.r);
  float splitFace=dot(n-substrate,normalize(vec3(-.61,.73,.31)));
  color+=vec3(.044,.047,.053)*splitFace*(.44+ex.r)*(.45+.90*damage);
  color*=.61+.43*smoothstep(.35,.92,ex.r)+.04*ex.g;
  color*=1.-.20*smoothstep(.54,.91,drainage.g);
  float schist=dot(parentFace,normalize(vec3(-.83,.41,.38)));
  float stainDepth=smoothstep(.48,.73,fb(vec2(p.x*.053+.74*vn(p/86.),p.y*.0038)+13.)+.21*(run-.52));
  float oldFace=(1.-.71*history.b)*(1.-.36*history.a);
  color*=mix(vec3(1.),vec3(.71,.77,.84),stainDepth*oldFace);
  color*=.91+.20*smoothstep(-.17,.75,schist);
  color*=mix(1.,.73,smoothstep(70.,166.,p.x)*(1.-smoothstep(173.,251.,p.y)));

  float iron=smoothstep(.47,.73,drainage.b)*waterVarnish*smoothstep(.43,.62,province);
  color*=mix(vec3(1.),vec3(1.19,1.05,.84),iron);
  color+=vec3(.015,.019,.021)*(1.-smoothstep(.19,.47,drainage.g))*(.39+.61*ex.r);

  // Directional skylight changes slowly over each joint-bounded granite face.
  // Feldspar grains, open fissures and runoff stain the surface at shorter scales.
  vec3 majorNormal=normalize(mix(substrate,parentFace,.82));
  vec3 splitNormal=normalize(mix(majorNormal,n,.15+.16*damage));
  float oblique=max(0.,dot(splitNormal,normalize(vec3(-.78,.62,.31))));
  float planeSky=.41+.54*oblique+.13*max(0.,majorNormal.y);
  float enclosure=.50+.56*sqrt(max(.015,ex.r));
  float oldStone=smoothstep(.30,.73,.63*province+.37*run);
  vec3 feldspar=mix(vec3(.139,.160,.187),vec3(.213,.239,.271),oldStone);
  float trace=fb(vec2(p.x*.076+.6*vn(p/31.),p.y*.008)+26.);
  float flutes=fb(vec2(p.x*.61+.51*vn(p/12.),p.y*.038)+17.);
  feldspar*=mix(vec3(1.),vec3(.68,.68,.72),smoothstep(.37,.71,trace+.25*(run-.5))*.69);
  feldspar*=.90+.18*flutes;
  float newRock=history.b*(1.-.59*smoothstep(324.,430.,p.y))*(.41+.57*xenolith);
  vec3 clean=mix(vec3(.255,.283,.317),vec3(.36,.36,.355),.67*patina+.33*polish);
  feldspar=mix(feldspar,clean,newRock);
  float edgeShade=mix(.69,1.045,smoothstep(.17,.83,ex.r))*mix(.83,1.06,smoothstep(-.5,.68,schist));
  vec3 planeLight=feldspar*planeSky*enclosure*edgeShade*(.90+.27*day);
  planeLight*=.82+.32*localPlanes+.12*(flake-.5)+.24*(crystal.b-.5);
  planeLight*=1.-.61*fault.r;
  planeLight+=vec3(.046,.055,.066)*fault.g*(.43+.62*ex.r);
  planeLight+=vec3(.035,.041,.049)*quartzSeam*(.52+.48*planeSky);
  planeLight*=mix(vec3(1.),vec3(.58,.68,.79),gulch);
  float freshMica=smoothstep(.70,.89,crystal.b+.095*(flake-.5));
  planeLight+=vec3(.032,.033,.034)*freshMica*(.21+.79*damage);
  float upperWall=smoothstep(306.,416.,p.y)*exp(-pow((p.x-177.)/174.,2.));
  float bottomGorge=smoothstep(64.,165.,p.x)*(1.-smoothstep(155.,233.,p.y));
  vec3 calibration=mix(vec3(1.55,1.91,2.23),vec3(2.09,2.18,2.32),upperWall);
  planeLight*=mix(calibration,vec3(1.06,1.30,1.45),bottomGorge*.91);
  planeLight*=mix(vec3(1.),vec3(.57,.63,.68),smoothstep(248.,281.,p.x)*smoothstep(330.,405.,p.y));
  float ferric=smoothstep(.38,.72,fb(vec2(p.x*.28,p.y*.011)+20.));
  float fallSide=exp(-pow((p.x-199.)/40.,2.))*smoothstep(269.,389.,p.y);
  planeLight*=mix(vec3(1.),vec3(1.29,1.01,.80),fallSide*(.45+.55*ferric));
  planeLight*=mix(vec3(1.),vec3(1.21,.98,.78),exp(-pow((p.x-188.)/65.,2.))*(1.-smoothstep(259.,336.,p.y))*smoothstep(130.,187.,p.y));
  float rockFootprint=max(length(dFdx(world)),length(dFdy(world)));
  float resolved=1.-smoothstep(.24,1.52,rockFootprint);
  float pits=triangular((s+warp*.34)/vec2(.37,.71)+31.)-.5;
  float chips=triangular((s+warp*.65)/vec2(.86,1.62)+74.)-.5;
  planeLight*=1.+(1.19*(crystal.b-.53)+.52*pits+.64*chips)*(.43+.57*resolved);
  vec2 pattern=p+vec2(.18*world.z,.094*world.z);
  vec2 smallJoint=steppedFissures(vec2((pattern.x-.15*pattern.y)*.98,pattern.y*.122),13.);
  vec2 obliqueJoint=steppedFissures(vec2((pattern.y-.54*pattern.x)*1.42,pattern.x*.168),67.);
  planeLight*=1.-(.65*smallJoint.x+.58*obliqueJoint.x)*(.45+.55*damage);
  planeLight+=vec3(.060,.066,.074)*(smallJoint.y+.80*obliqueJoint.y)*(.39+.61*ex.r);
  planeLight+=vec3(.005,.009,.020)*(.46+.54*ex.r);
  color=mix(color,planeLight,.71+.13*history.a);
  float rime=fb(p/vec2(12.,9.))*.25+fb(p/1.83)*.13;
  float settle=smoothstep(.87,.985,normalize(vec3(slope,sqrt(max(.0002,1.-dot(slope,slope))))).y+rime-.15)*smoothstep(.27,.50,fb(p/vec2(29.,20.)+67.));
  color=mix(color,vec3(.38,.46,.58)*(.57+.44*ex.r+.20*day)*(.92+.13*vein),settle*.32);
  float below=texture2D(macroField,mapUV).g-p.y;
  float rim=exp(-max(0.,below)/(3.+5.*wash));
  float xfall=242.-.059*max(0.,448.-p.y);float dx=p.x-xfall;
  float moist=exp(-dx*dx/109.)*step(p.y,451.);color*=1.-.19*moist;
  float grazing=max(0.,dot(n,normalize(vec3(-.993,.118,.102))));
  float wetShine=moist*pow(grazing,2.)*smoothstep(.42,.71,run);
  float warmSlope=rim*(.18+.82*ex.b)*1.33*pow(grazing,1.12);
  float needleRim=exp(-max(0.,below)/(1.7+2.9*wash))*(.04+.96*max(0.,grazing))*smoothstep(.28,.66,vein+.20*fault.g);
  float reflected=exp(-abs(dx)/13.)*smoothstep(.28,.64,run)*max(0.,n.x*.72+n.z*.20)*smoothstep(55.,145.,p.y);
  color+=sunColor()*amber*reflected*.085;
  float shoulder=exp(-pow((p.x-193.)/66.,2.))+.84*exp(-pow((p.x+270.)/64.,2.));
  float raking=exp(-max(0.,below)/(5.4+5.*wash))*(.10+.90*max(0.,dot(substrate,normalize(vec3(-.56,.79,.17)))))*(.21+.79*smoothstep(.25,.75,run+fault.g*.7));
  float evening=(1.-smoothstep(198.,261.,p.x))*max(.47,ex.b);
  float recess=texture2D(macroField,mapUV).g-p.y;
  float sideLight=smoothstep(.18,.77,dot(parentFace,normalize(vec3(-.989,.111,.097))));
  float wallBand=smoothstep(.36,.72,fb(vec2(p.x*.081,p.y*.008)+34.));
  float nearLip=exp(-pow((p.x-207.)/66.,2.));
  color+=sunColor()*amber*nearLip*sideLight*wallBand*exp(-max(0.,recess)/51.)*(.22+.46*ex.b);
  color+=sunColor()*amber*(warmSlope*.27+shoulder*raking*.39+needleRim*(.24+.66*shoulder)*evening+.4*wetShine*ex.b);
  float head=exp(-pow((p.x+290.)/68.,2.))*exp(-max(0.,below)/(7.+5.2*wash));
  color+=sunColor()*amber*head*(.09+.85*max(0.,dot(substrate,normalize(vec3(-.78,.54,.05)))))*(.25+.75*ex.b);
  if(below<12.&&p.y>361.){
    float sunlight=eveningSun(world+substrate*.36)*max(0.,dot(n,normalize(vec3(-.99,.123,.108))));
    color+=sunColor()*amber*sunlight*exp(-max(0.,below)/5.2)*(.19+.32*vein);
  }
  float westRim=exp(-pow((p.x+279.)/76.,2.));
  float capEdge=exp(-max(0.,below)/(6.1+3.6*wash))*(.23+.77*max(0.,dot(parentFace,normalize(vec3(-.84,.45,.19)))));
  float sunset=clamp(westRim*capEdge*(1.4+1.2*ex.b)*amber,0.,.94);
  vec3 sunStone=mix(vec3(.40,.216,.122),vec3(.73,.445,.235),.46*vein+.54*run);
  color=mix(color,sunStone*(.67+.42*ex.r),sunset);
  color*=mix(1.,skyShadow(world+substrate*.48),.42);
  float litSun=exp(-max(0.,below)/(3.1+3.*wash))*ex.b;
  color=weatheredRock(color,world,n,substrate,ex.r,litSun,history.b,run,.33+.43*crystal.b,amber,red);
  color+=(speckle-.5)*.013;
  gl_FragColor=vec4(atmosphere(color,world),1.);
}`;
