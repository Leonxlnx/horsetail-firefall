import * as T from "three";
import {grid,rng,front,crest,summit,mix,step} from "./batholith.js";
import {U,stoneNoise} from "./granite.js";
const common=`
uniform float clockTime,amber,red,flow,dusk;uniform vec3 lip,toe;uniform float ledge;
uniform highp sampler3D cloud;uniform sampler2D course,oldDepth,oldColor;uniform vec2 screenSize;
vec3 center(float y){return textureLod(course,vec2(clamp((lip.y-y)/(lip.y-toe.y),0.,1.),.5),0.).xyz;}
float travel(float drop){return (sqrt(20.25+19.62*max(0.,drop))-4.5)/9.81;}
float eddy(vec3 p){return textureLod(cloud,p,0.).g-.5;}
`;
const depthCheck=`if(gl_FragCoord.z>texture2D(oldDepth,gl_FragCoord.xy/screenSize).r+.0000015)discard;`;
function instanced(base,attributes){
 const g=new T.InstancedBufferGeometry();g.index=base.index;for(const key of ["position","uv"])g.setAttribute(key,base.attributes[key]);
 for(const [key,[a,n]] of Object.entries(attributes))g.setAttribute(key,new T.InstancedBufferAttribute(new Float32Array(a),n));g.instanceCount=Object.values(attributes)[0][0].length/4;return g;
}
export class Ligaments{
 constructor(shared,course){
   this.scene=new T.Scene();this.u={...shared,screenSize:U(new T.Vector2())};
   const parcel=rng(3791);
   const add=(g,vs,fs,order)=>{
     const m=new T.Mesh(g,new T.ShaderMaterial({uniforms:this.u,vertexShader:vs,fragmentShader:fs,transparent:true,depthTest:false,depthWrite:false,forceSinglePass:true,side:T.DoubleSide}));
     m.frustumCulled=false;m.renderOrder=order;this.scene.add(m);
   };
   const webs=[];
   for(let i=0;i<26;i++)webs.push((i%13)/12,i*.173,parcel(),i<13?0:1);
   const web=instanced(grid(13,217,(u,v)=>[u,v,0]),{dropBand:[webs,4]});
   add(web,`${common}
    attribute vec4 dropBand;varying vec3 flowPosition;varying vec2 uvFlow;varying float age,spice,wind,phase;
    void main(){
      float top=mix(lip.y,ledge,dropBand.w),end=mix(ledge,toe.y,dropBand.w),v=uv.y;
      float y=mix(top,end,v),adv=travel(top-y)-clockTime;
      vec3 p=center(y);float t=dropBand.x*2.-1.,salt=dropBand.y;
      float slow=eddy(vec3(salt,adv*.043+salt,p.y*.002));
      float curl=eddy(vec3(salt*1.3,adv*.195,p.y*.0047));
      float ageSpread=1.-exp(-v*14.);
      float radius=mix((1.64+6.7*sqrt(v))*(1.-.16*v),.85+2.25*sqrt(v),dropBand.w);
      float middle=5.7*eddy(vec3(p.y*.0032,adv*.089,.32))*ageSpread+radius*(t*.88+(slow*1.88+curl*.86)*ageSpread);
      middle+=t*abs(t)*v*(3.1+dropBand.z*2.6);
      float thick=radius*(.13+.23*dropBand.z)*(.79+1.2*curl);
      p.x+=middle+(uv.x*2.-1.)*thick;
      p.z+=1.35+2.1*dropBand.z+2.7*slow+.50*sin(v*29.+t*3.+adv*.53)+(uv.x-.5)*curl;
      float edge=uv.x*2.-1.;
      p.z+=(1.-edge*edge)*thick*(.32+.73*curl)+sin(edge*2.95+adv*.81+salt)*thick*.25;
      flowPosition=p;uvFlow=uv;age=adv;spice=salt;wind=curl;phase=t;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
    }`,`${common}varying vec3 flowPosition;varying vec2 uvFlow;varying float age,spice,wind,phase;
    void main(){${depthCheck}
      float u=uvFlow.x*2.-1.;
      float r=eddy(vec3(u*.34+wind*.18,age*.72+spice,spice*.81));
      float f=eddy(vec3(u*1.6+r*.027,age*1.2,spice));
      float band=exp(-u*u*4.6)*(1.-smoothstep(.69,1.,abs(u)));
      float breakup=smoothstep(-.18,.24,eddy(vec3(spice,age*.38,uvFlow.y*.17))+r*.79);
      float extinction=band*(.022+.88*breakup)*(.55+.80*smoothstep(-.22,.19,r+.51*f));
      extinction*=1.-.78*phase*phase;float a=(1.-exp(-extinction))*.86*flow;
      vec3 hot=mix(vec3(.97,.39,.084),vec3(1.,.81,.32),breakup*.69+f*.33+.1);
      hot=mix(hot,vec3(1.,.35+.29*breakup,.10),red);
      vec3 view=normalize(cameraPosition-flowPosition);
      vec3 N=normalize(cross(dFdx(flowPosition),dFdy(flowPosition)));
      if(dot(N,view)<0.)N=-N;
      float edgeGlint=pow(1.-abs(dot(N,view)),2.7),fresnel=.021+.979*edgeGlint;
      vec3 normalEye=mat3(viewMatrix)*N;
      vec2 bend=normalEye.xy*(1.1+2.3*abs(wind))/screenSize;
      vec3 transmission=texture2D(oldColor,clamp(gl_FragCoord.xy/screenSize+bend,.001,.999)).rgb;
      float solar=pow(max(0.,dot(reflect(-normalize(vec3(-.99,.123,.108)),N),view)),33.);
      float foot=smoothstep(18.,79.,flowPosition.y-toe.y);
      hot*=mix(vec3(.96,.76,.70),vec3(1.),foot);
      vec3 scattered=mix(vec3(.83,.88,.94)*mix(1.,.35,dusk),hot,amber);
      float opacityBias=.55+.34*breakup+.10*fresnel;
      vec3 radiance=mix(transmission,scattered,opacityBias)+amber*vec3(1.,.73,.39)*(.53*solar+.095*edgeGlint);
      gl_FragColor=vec4(radiance,a);
    }`,1);
   const seeds=[],speeds=[];
   for(let i=0;i<17500;i++){
     const mode=i<6200?0:i<10300?1:i<12600?2:3;
     seeds.push(parcel(),parcel(),parcel(),mode);
     speeds.push(parcel(),parcel(),parcel(),parcel());
   }
   const drops=instanced(new T.PlaneGeometry(1,1),{seed:[seeds,4],speed:[speeds,4]});
   add(drops,`${common}attribute vec4 seed,speed;varying vec2 q;varying float opacity,colorV;
    void main(){
      float mode=seed.w;float span=.6+1.52*speed.x,phase=fract(clockTime/span+seed.x),t=phase*span;
      vec3 p,vel;float theta=seed.y*6.283;
      if(mode<1.5){float y=mix(toe.y-.24,ledge+.7,mode);p=center(y);
        float fan=1.-mode;
        float cluster=floor(seed.y*9.)*6.283/9.+.21*sin(clockTime*.77+floor(seed.y*9.))+(.34*speed.z-.17);
        theta=mix(theta,cluster,fan*.88);
        float s=(1.2+14.6*pow(seed.z,.68))*(1.+.04*fan);
        vel=vec3(cos(theta)*s+1.7,2.2+(8.1+3.6*fan)*speed.y,sin(theta)*s*.73+2.6);
        p+=vec3((speed.z-.5)*1.9,mix(.13,.36,mode),.58+.69*speed.y);
        p+=vel*t+vec3(.51,-4.905,.09)*t*t;vel.y-=9.81*t;
      }else if(mode<2.5){
        p=lip+vec3(-14.+seed.y*18.,.64+seed.z*2.5,-1.-seed.z*11.);
        vel=vec3(2.8+4.7*speed.y,.87+1.74*speed.z,.64);
        p+=vel*t+vec3(.39,-.69,.01)*t*t;vel.y-=1.38*t;
      }else{
        float y=mix(ledge+1.,lip.y-1.,seed.y);p=center(y);
        vel=vec3((seed.z-.40)*5.,-4.4-12.*speed.y,(speed.z-.27)*4.);
        p+=vec3((speed.w-.5)*6.,0.,1.3)+vel*t+vec3(.84,-4.905,.08)*t*t;vel.y-=9.81*t;
      }
      vec4 mv=viewMatrix*vec4(p,1.);vec2 axis=normalize((mat3(viewMatrix)*vel).xy+vec2(.0001));vec2 across=vec2(axis.y,-axis.x);
      float pixel=(-mv.z)*2./(projectionMatrix[1][1]*screenSize.y);
      float rad=(.008+.036*speed.w)*(mode<.5?1.28:1.);float width=max(pixel*.56,rad);
      q=uv*2.-1.;mv.xy+=across*q.x*width+axis*q.y*(length(vel)*(.013+.013*speed.w)+rad);
      opacity=smoothstep(0.,.07,phase)*(1.-smoothstep(.60,1.,phase))*min(1.,rad/width)*(.21+.54*speed.z);
      opacity*=mode<.5?.65:1.;colorV=speed.y;gl_Position=projectionMatrix*mv;
    }`,`${common}varying vec2 q;varying float opacity,colorV;void main(){${depthCheck}
      float g=max(0.,1.-q.x*q.x)*max(0.,1.-q.y*q.y);
      vec3 color=mix(vec3(.78,.85,.91)*mix(1.,.35,dusk),mix(vec3(1.,.76+colorV*.12,.40),vec3(1.,.48,.21),red),amber);
      gl_FragColor=vec4(color,g*opacity*flow);}`,2);
   // Thin ejecta sheets rise coherently from projecting edges of the wet rock.
   // Their outer ends disintegrate into the ballistic droplet field.
   const jets=[];
   for(let i=0;i<17;i++)jets.push(i/17,parcel(),parcel(),parcel());
   add(instanced(grid(7,47,(u,v)=>[u,v,0]),{jet:[jets,4]}),
     `${common}attribute vec4 jet;varying vec2 vFan;varying float grainPhase,exposure;
      void main(){float t=uv.y*(.58+.65*jet.y),pulse=clockTime-t;
        float ang=jet.x*6.283+.15*sin(jet.z*61.+pulse*.83);
        vec2 aim=vec2(cos(ang),sin(ang)),across=vec2(-aim.y,aim.x);
        float kick=8.1+8.2*jet.w,up=4.2+5.4*jet.y;
        float gust=eddy(vec3(jet.y,jet.z,pulse*.28));
        vec2 travel=aim*kick*t+vec2(.60,.19)*t*t;
        float edge=(uv.x-.5)*(.095+1.34*t)*(.7+jet.z);
        travel+=across*(edge+.58*t*gust);
        vec3 p=toe+vec3(travel.x,-.13+up*t-4.905*t*t,.47+travel.y);
        p.y+=edge*(.47+gust)+t*t*.40*sin(jet.w*41.+pulse*1.94);
        vFan=uv;grainPhase=pulse*.74+jet.y*17.;exposure=.38+.59*jet.z;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
     `${common}varying vec2 vFan;varying float grainPhase,exposure;void main(){${depthCheck}
        float streak=eddy(vec3(vFan.x*.49,vFan.y*1.47-grainPhase*.39,grainPhase*.31));
        float strip=1.-smoothstep(.20,.50,abs(vFan.x-.5));
        float dry=1.-smoothstep(.28,1.,vFan.y);
        float mass=strip*(.10+.78*dry)*(.19+.81*smoothstep(-.20,.19,streak+dry*.29));
        vec3 c=mix(vec3(.67,.78,.91),mix(vec3(1.,.66,.37),vec3(1.,.47,.25),red),amber);
        gl_FragColor=vec4(c,mass*exposure*.63*flow);}`,2);
   const snowSeeds=[],origins=[];
   for(let i=0;i<730;i++){
     const source=[154,176,198,216,232][i%5],x=source+(parcel()+parcel()-1)*7.3,d=.65+2.7*parcel(),y=summit(x,d),z=front(x,crest(x))-d;
     snowSeeds.push(parcel(),parcel(),parcel(),parcel());origins.push(x,y+.25,z,1);
   }
   add(instanced(new T.PlaneGeometry(1,1),{seed:[snowSeeds,4],sourcePoint:[origins,4]}),
     `${common}attribute vec4 seed,sourcePoint;varying vec2 uvSp;varying float lifetime,id;
      void main(){float t=fract(clockTime/(1.9+seed.y*3.4)+seed.x);vec3 p=sourcePoint.xyz;
       float gust=eddy(vec3(sourcePoint.x*.014,clockTime*.042,seed.z*.31));
       p.x+=(3.5+10.7*seed.z+3.6*gust)*t;p.z+=(2.1+3.7*seed.x)*t;
       p.y+=sin(t*2.85)*(.53+3.6*seed.y+2.8*gust)+t*.28;
       vec4 q=viewMatrix*vec4(p,1.);q.xy+=(uv-.5)*vec2(1.04+5.7*t,.19+1.61*t)*(1.+seed.z);
       uvSp=uv*2.-1.;lifetime=sin(3.14159*t);id=seed.w;gl_Position=projectionMatrix*q;}`,
     `${common}varying vec2 uvSp;varying float lifetime,id;void main(){${depthCheck}
        float s=eddy(vec3(uvSp*vec2(.08,.17)+id,clockTime*.025+id));
        float edge=max(0.,1.-dot(uvSp,uvSp));float opacity=lifetime*edge*edge*(.025+.121*smoothstep(-.20,.16,s));
        float hue=smoothstep(.15,.76,id);
        vec3 color=mix(vec3(.55,.64,.78),mix(vec3(.76,.61,.66),vec3(1.,.65,.36),hue),amber);
        gl_FragColor=vec4(color,opacity);}`,0);
   // The curtain loses thin, individually moving streaks to the crosswind.
   const tails=[];
   for(let i=0;i<76;i++)tails.push(parcel(),parcel(),parcel(),parcel());
   add(instanced(grid(5,89,(u,v)=>[u,v,0]),{seed:[tails,4]}),
    `${common}attribute vec4 seed;varying vec2 v;varying float lengthMix,rift;
     void main(){float h=mix(toe.y+18.,lip.y-1.,seed.x),span=8.+42.*seed.w;
       float d=uv.y*min(span,h-toe.y),y=h-d,age=travel(lip.y-y)-clockTime;
       vec3 p=center(y);float k=eddy(vec3(seed.z*.7,age*.33+seed.x,y*.007));
       float detachment=pow(uv.y,1.32)*(.3+seed.y*.7);
       p.x+=2.+seed.z*2.1+(5.+seed.w*13.)*detachment+3.*k;
       p.z+=1.8+(.9+seed.y)*7.*detachment+k;
       p.x+=(uv.x-.5)*(.18+.87*seed.y)*(1.-.81*uv.y);
       p.z+=.19*sin(uv.y*17.+age*.91+seed.z);
       v=uv;rift=seed.w;lengthMix=k;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    `${common}varying vec2 v;varying float lengthMix,rift;void main(){${depthCheck}
       float a=exp(-pow((v.x-.5)*3.9,2.))*sin(3.14159*v.y)*(.07+.16*rift)*flow;
       a*=smoothstep(-.30,.20,lengthMix+.57*eddy(vec3(v.x*.03,v.y*.36-clockTime*.083,rift)));
       gl_FragColor=vec4(mix(vec3(.64,.72,.84)*mix(1.,.35,dusk),mix(vec3(1.,.61,.23),vec3(1.,.26,.09),red),amber),a);}`,1);
   const apron=grid(17,71,(u,v)=>{
     const d=(1-v)*27,x=course.lip.x+(u-.5)*(1.65+d*.034)+d*.052,z=front(x,crest(x))-d;
     const reach=step(0,2.6,d);
     return [x,mix(course.lip.y+.03,summit(x,d)+.13,reach),mix(course.lip.z+.02,z,reach)];
   });
   add(apron,`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
    `${common}${stoneNoise}varying vec2 v;void main(){${depthCheck}
      float n=fb(vec2(v.x*3.5,v.y*19.-clockTime*2.6)),vel=smoothstep(.40,1.,v.y);
      vec3 color=mix(vec3(.44,.53,.63),mix(vec3(.97,.55,.20),vec3(1.,.81,.45),n),amber*vel);
      gl_FragColor=vec4(color,(1.-smoothstep(.31,.50,abs(v.x-.5)))*(.45+.52*n));}`,0);
 }
 draw(renderer,cam,target){
   this.u.screenSize.value.set(target.width,target.height);
   renderer.autoClear=false;renderer.render(this.scene,cam);renderer.autoClear=true;
 }
}
