import * as T from "three";
import {rng,noise} from "./batholith.js";
import {stoneNoise} from "./granite.js";

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const up=V(0,1,0);
export function winterBoughs(scene,lighting){
 const r=rng(6190705),P=[],N=[],part=[],light=[],starts=[],vectors=[],features=[];
 function face(a,b,c,n,m,q,type,shade){
   for(const [p,v] of [[a,n],[b,m],[c,q]]){P.push(p.x,p.y,p.z);N.push(v.x,v.y,v.z);part.push(type);light.push(shade);}
 }
 function bark(a,b,ra,rb,detail,shade){
   const dir=b.clone().sub(a).normalize(),v=dir.clone().cross(Math.abs(dir.y)>.93?V(0,0,1):up).normalize(),w=dir.clone().cross(v);
   for(let k=0;k<detail;k++){
     const at=t=>v.clone().multiplyScalar(Math.cos(t)).addScaledVector(w,Math.sin(t));
     const n=at(2*Math.PI*k/detail),m=at(2*Math.PI*(k+1)/detail),a0=a.clone().addScaledVector(n,ra),a1=a.clone().addScaledVector(m,ra);
     const b0=b.clone().addScaledVector(n,rb),b1=b.clone().addScaledVector(m,rb);
     face(a0,a1,b0,n,m,n,0,shade);face(a1,b1,b0,m,m,n,0,shade);
   }
 }
 // Heavy snow sits across groups of neighbouring shoots. The windward edge is
 // thinned and the lee side hangs over the needles in scallops.
 function snow(a,b,width,depth,seed,shade){
   const dir=b.clone().sub(a),long=dir.length();dir.normalize();
   const side=dir.clone().cross(up).normalize(),top=side.clone().cross(dir).normalize(),rows=[];
   const n=12,m=11;
   for(let i=0;i<=n;i++){
     const t=i/n,spine=a.clone().addScaledVector(dir,t*long);
     const env=.04+.96*Math.sin(Math.PI*t)**.56,breadth=width*env*(.93+.11*Math.sin(t*11.6+seed)+.07*Math.sin(t*19.+1.1*seed));
     for(let j=0;j<m;j++){
       const theta=j*2*Math.PI/m,c=Math.cos(theta),s=Math.sin(theta),lee=c*.23;
       const edge=1.+.10*Math.sin(t*16.4+seed+c*2.)+.055*Math.sin(t*26.+c*7.-seed);
       const p=spine.clone().addScaledVector(side,c*breadth*edge+.15*breadth*Math.sin(t*8.7+seed));
       const h=depth*env*((s>.0?.60:.39)*s+.29+lee)-Math.abs(c)**4*.13*breadth*(1.+.57*Math.sin(t*14.+seed));
       p.addScaledVector(top,h);
       const normal=side.clone().multiplyScalar(c*.81).addScaledVector(top,s*1.18).addScaledVector(dir,(t-.5)*.56).normalize();
       if(!rows[i])rows[i]=[];rows[i].push([p,normal]);
     }
   }
   for(let i=0;i<n;i++)for(let j=0;j<m;j++){
     const a=rows[i][j],b=rows[i+1][j],c=rows[i][(j+1)%m],d=rows[i+1][(j+1)%m];
     face(a[0],b[0],c[0],a[1],b[1],c[1],1,shade);face(c[0],b[0],d[0],c[1],b[1],d[1],1,shade);
   }
 }
 function tuft(base,axis,length,density,illum){
   const dir=axis.clone().normalize(),v=dir.clone().cross(Math.abs(dir.y)>.93?V(0,0,1):up).normalize(),w=dir.clone().cross(v);
   const bow=v.clone().multiplyScalar((r()-.5)*length*.19).addScaledVector(up,-length*(.06+.13*r()));
   const twig=t=>base.clone().addScaledVector(dir,t*length).addScaledVector(bow,t*t);
   bark(base,twig(.62),.0065,.004,4,illum);bark(twig(.62),twig(1),.004,.0018,3,illum);
   const pairs=Math.floor((57+23*r())*density),spin=r()*6.283;
   for(let k=0;k<pairs;k++){
     const t=(k+.3*r())/pairs,p=twig(t),a=spin+k*2.39996+(r()-.5)*.61;
     const radial=v.clone().multiplyScalar(Math.cos(a)).addScaledVector(w,Math.sin(a));
     const L=(.042+.042*r())*(.76+.25*Math.sin(t*Math.PI))*(.70+.37*density);
     const delta=radial.clone().multiplyScalar(.72+.32*r()).addScaledVector(dir,.36+.34*r()).normalize().multiplyScalar(L);
     delta.y-=.006*r();
     starts.push(p.x,p.y,p.z);vectors.push(delta.x,delta.y,delta.z);
     features.push(.0012+.00145*r(),illum*(.66+.43*r()),.1+.9*r(),r());
   }
 }
 // Snow falling between fans bridges adjacent shoots. The crown is continuous
 // through a span, with an overhanging wind lip and a darker, irregular underside.
 function blanket(curve,lo,hi,scale,seed,shade){
   const rows=[],steps=24,sectors=18;
   for(let i=0;i<=steps;i++){
     const u=i/steps,t=lo+(hi-lo)*u,axis=curve.getTangent(t).normalize();
     const cross=axis.clone().cross(up).normalize(),top=cross.clone().cross(axis).normalize();
     const origin=curve.getPoint(t),end=.03+.97*Math.sin(Math.PI*u)**.49;
     const drift=.40+.12*noise(u*5.4,seed)+.08*noise(u*12,seed+11);
     const thick=(.28+.08*noise(u*6,seed+32))*scale;
     const row=[];
     for(let j=0;j<sectors;j++){
       const ang=j*2*Math.PI/sectors,c=Math.cos(ang),v=Math.sin(ang);
       const lee=1.+c*(.21+.15*noise(u*3,seed+21));
       const edge=(drift+.074*noise(u*16,c*1.44+seed)+.027*noise(u*29,c*2+seed))*scale*end*lee;
       const crown=v>=0?.53*v**.78:-.40*(-v)**.63;
       const height=thick*end*(.09+crown+.13*c)-.18*edge*Math.abs(c)**4;
       const p=origin.clone().addScaledVector(cross,edge*c).addScaledVector(top,.12*scale+height);
       row.push(p);
     }rows.push(row);
   }
   const ns=rows.map((row,i)=>row.map((_,j)=>{
     const dt=rows[Math.min(steps,i+1)][j].clone().sub(rows[Math.max(0,i-1)][j]);
     const da=row[(j+1)%sectors].clone().sub(row[(j+sectors-1)%sectors]);
     return dt.cross(da).normalize();
   }));
   for(let i=0;i<steps;i++)for(let j=0;j<sectors;j++){
     const k=(j+1)%sectors,a=rows[i][j],b=rows[i+1][j],c=rows[i][k],d=rows[i+1][k];
     face(a,b,c,ns[i][j],ns[i+1][j],ns[i][k],1,shade);
     face(c,b,d,ns[i][k],ns[i+1][j],ns[i+1][k],1,shade);
   }
 }
 function branch(points,scale,snowLoad){
   const curve=new T.CatmullRomCurve3(points,false,"centripetal"),L=curve.getLength(),az=r()*6.28;
   const center=t=>curve.getPoint(t),limbs=Math.round(4.5+L*.83),shade=.72+.18*r();
   for(let i=0;i<13;i++)bark(center(i/13),center((i+1)/13),(.015+.14*(1-i/13)**.9)*scale,(.015+.14*(1-(i+1)/13)**.9)*scale,8,shade);
   const sideLimb=points[0].y<38.6;
   if(sideLimb||snowLoad>.80){
     blanket(curve,.04,.62,scale*(sideLimb?1.75:1.00),az+31.,shade);
     blanket(curve,.51,.96,scale*(sideLimb?1.21:.67),az+49.,shade);
   }
   const tip=curve.getTangent(.97).normalize();
   tuft(center(.92),tip,.37*scale,.92,shade);
   tuft(center(.95),tip.clone().addScaledVector(up,-.31),.30*scale,.89,shade);
   for(let k=0;k<limbs;k++){
     const t=.12+(k+.51*r())/limbs*.84,a=center(t),delta=curve.getTangent(t).normalize(),trans=delta.clone().cross(up).normalize();
     const side=(k%2?-1:1),theta=.37+r()*.69,len=(.89+1.21*r())*(1.-.43*t)*scale;
     const axis=delta.clone().multiplyScalar(Math.cos(theta)*.83).addScaledVector(trans,Math.sin(theta)*side).normalize();
     const droop=.19+.38*r(),curvelet=u=>a.clone().addScaledVector(axis,len*u).addScaledVector(up,-len*(droop*u+.16*Math.sin(Math.PI*u)));
     for(let j=0;j<4;j++)bark(curvelet(j/4),curvelet((j+1)/4),(.012+.025*(1-j/4))*scale,(.007+.022*(1-j/4))*scale,5,shade);
     const local=axis.clone().cross(up).normalize(),fanSpin=r()*6.28;
     const heavy=r()<snowLoad,branchlets=5+Math.floor(r()*6);
     for(let j=0;j<branchlets;j++){
       const u=.10+(j+r()*.69)/branchlets*.88,node=curvelet(u),sgn=(j%2?1:-1),swing=.48+.74*r();
       const d=axis.clone().multiplyScalar(.42+.33*r()).addScaledVector(local,sgn*swing).addScaledVector(up,-.36-.73*r()).normalize();
       const tail=(.20+.39*r())*scale*(1.-.37*u);
       tuft(node,d,tail,1.+.28*r(),shade);
       for(let shoot=0;shoot<3+Math.floor(3*r());shoot++){
         const f=.16+.65*r(),origin=node.clone().addScaledVector(d,tail*f);
         const drift=d.clone().multiplyScalar(.70).addScaledVector(local,(r()-.48)*1.26).addScaledVector(up,-.2-.5*r()).normalize();
         tuft(origin,drift,tail*(.30+.48*r()),.69+.43*r(),shade*(.82+.19*r()));
       }
       if(heavy&&r()<.64){
         const end=node.clone().addScaledVector(d,tail*(.67+.27*r()));end.y+=.045*scale;
         snow(node.clone().addScaledVector(up,.046*scale),end,(.07+.11*r())*scale*(1.-.23*u),(.12+.17*r())*scale,fanSpin+j,shade);
       }
     }
     if(heavy){
       const span=1+Math.floor(r()*3);
       for(let i=0;i<span;i++){
         const lo=.10+i*.79/span+.05*r(),hi=Math.min(.99,lo+.91/span);
         snow(curvelet(lo).addScaledVector(up,.058*scale),curvelet(hi).addScaledVector(up,.038*scale),
           (.18+.13*r())*scale*(1.-.3*lo),(.23+.15*r())*scale,az+i+.7*k,shade);
       }
     }
   }
 }
 branch([V(-34.45,37.26,775.),V(-32.85,37.04,776.),V(-31.1,36.71,776.9),V(-29.8,36.56,777.1)],1.05,.96);
 // Near branches enter from just outside the lens, leaving the open cliff face clear.
 branch([V(-34.4,42.9,775.0),V(-31.6,42.4,776.8),V(-29.1,41.5,778.2),V(-26.5,41.0,778.0),V(-24.5,40.5,777.1)],1.04,.82);
 branch([V(-34.5,40.5,775.2),V(-32.2,39.9,776.4),V(-29.9,39.1,778.1),V(-28.9,38.8,778.7)],.88,.73);
 branch([V(-34.5,34.2,775.),V(-32.7,34.1,776.1),V(-30.9,33.8,778.2),V(-29.3,33.5,778.6)],1.13,.89);
 branch([V(-34.5,32.9,775.),V(-32.1,33.25,775.6),V(-29.3,33.2,777.4),V(-26.3,32.5,778.0)],1.20,.96);
 branch([V(-34.6,35.3,775.0),V(-32.0,34.8,777.0),V(-30.3,34.4,778.5),V(-28.9,34.0,779.2)],1.15,.95);
 branch([V(-14.1,42.5,774.3),V(-16.1,41.8,775.3),V(-18.3,41.4,776.8),V(-20.9,40.9,777.1)],.95,.67);
 branch([V(-14.1,37.3,774.3),V(-15.8,36.9,776.4),V(-17.4,36.2,777.4)],.97,.86);
 branch([V(-14.1,32.6,774.3),V(-16.4,32.3,775.2),V(-18.2,32.2,777.7)],1.05,.94);
 for(const [x,z] of [[-34.55,775.0],[-14.05,774.2]]){
   const barkRings=[],sections=48,levels=78;
   for(let i=0;i<=levels;i++){
     const y=1.+i*.66,rad=.685-.0067*(y-1.),row=[];
     for(let j=0;j<sections;j++){
       const angle=j*Math.PI*2/sections;
       const track=angle*10.+.53*Math.sin(y*.43+angle*2.)+.24*Math.sin(y*.78-angle);
       const ruffle=.027*Math.cos(track)+.012*Math.sin(track*2.37+y*.19);
       const radius=rad+ruffle;
       const q=V(x+.13*Math.sin(y*.11)+radius*Math.cos(angle),y,z+.087*Math.sin(y*.19)+radius*Math.sin(angle));
       const bump=.24*Math.sin(track);
       const n=V(Math.cos(angle)-bump*Math.sin(angle),.05+ruffle*.64,Math.sin(angle)+bump*Math.cos(angle)).normalize();
       row.push([q,n]);
     }barkRings.push(row);
   }
   for(let i=0;i<levels;i++)for(let j=0;j<sections;j++){
     const k=(j+1)%sections,a=barkRings[i][j],b=barkRings[i+1][j],c=barkRings[i][k],d=barkRings[i+1][k];
     face(a[0],b[0],c[0],a[1],b[1],c[1],2,.78);
     face(c[0],b[0],d[0],c[1],b[1],d[1],2,.78);
   }
 }
 const geom=new T.BufferGeometry();
 for(const [name,a,size] of [["position",P,3],["normal",N,3],["part",part,1],["light",light,1]])geom.setAttribute(name,new T.Float32BufferAttribute(a,size));
 geom.computeBoundingSphere();
 const mat=new T.ShaderMaterial({uniforms:lighting,side:T.DoubleSide,
 vertexShader:`attribute float part,light;varying vec3 p,n;varying float kind,openSky;
 void main(){p=position;n=normal;kind=part;openSky=light;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p,n;varying float kind,openSky;uniform float day;`+stoneNoise+`
 void main(){vec3 N=normalize(n);float top=max(0.,N.y),side=max(0.,dot(N,normalize(vec3(-.72,.60,.30))));
 float field=fb(p.xz*4.+p.xy*.8);vec3 color;
 if(kind>.5&&kind<1.5){
   float rim=pow(1.-abs(dot(N,normalize(cameraPosition-p))),3.);
   vec3 frost=mix(vec3(.44,.55,.74),vec3(.64,.72,.87),field);
   color=frost*(.46+.35*top+.22*side)*(.82+.19*openSky)+vec3(.036,.047,.067)*rim;
 }else{
   float furrow=fb(vec2(p.x*22.+p.z*17.+.6*vn(p.xy),p.y*2.6)),flake=vn(p.xz*28.+p.xy*7.);
   color=mix(vec3(.058,.052,.049),vec3(.228,.161,.112),smoothstep(.26,.75,furrow))*(.49+.34*side+.18*top)*(.86+.19*flake);
 }
 if(kind>1.5){
   float scab=fb(vec2(p.x*31.+p.z*21.+.9*vn(p.xy*2.),p.y*3.4));
   float loam=fb(vec2(p.x*8.+p.z*9.,p.y*.92));
   color*=.76+.43*smoothstep(.28,.72,scab);
   float frost=smoothstep(.56,.72,.60*loam+.40*scab)*smoothstep(-.35,.69,-N.x+.31*N.z);
   color=mix(color,vec3(.49,.58,.74)*(.73+.24*loam),frost*.89);
 }
 gl_FragColor=vec4(color*(.94+.14*day),1.);}`});
 const solids=new T.Mesh(geom,mat);scene.add(solids);
 const g=new T.InstancedBufferGeometry(),base=new T.PlaneGeometry(1,1);g.index=base.index;g.setAttribute("position",base.attributes.position);g.setAttribute("uv",base.attributes.uv);
 for(const [name,a,size] of [["root",starts,3],["offset",vectors,3],["traits",features,4]])g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(a),size));
 g.instanceCount=starts.length/3;g.boundingSphere=new T.Sphere(V(-24,35,777),24);
 const needleMat=new T.ShaderMaterial({uniforms:{...lighting,heightPixels:{value:720}},transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
 vertexShader:`attribute vec3 root,offset;attribute vec4 traits;varying float across,coverage,illum,tip;varying vec3 hue;uniform float heightPixels,clockTime;
 void main(){vec3 a=root,b=root+offset;b.x+=.0045*sin(root.x*.8+root.z*.51+clockTime*1.8+traits.w);
 vec4 start=viewMatrix*vec4(a,1.),end=viewMatrix*vec4(b,1.);vec2 delta=end.xy/max(.01,-end.z)-start.xy/max(.01,-start.z);
 vec2 side=vec2(-delta.y,delta.x)/max(.000001,length(delta));float t=uv.y;vec4 p=mix(start,end,t);
 float pixel=max(.0003,-p.z*2./(projectionMatrix[1][1]*heightPixels)),radius=traits.x*(.90-.75*t);
 float support=max(radius,pixel*.55);p.xy+=side*(uv.x*2.-1.)*support;
 coverage=min(1.,radius/support);across=uv.x*2.-1.;tip=t;illum=traits.y;
 hue=mix(vec3(.032,.061,.046),vec3(.102,.155,.099),traits.z);
 gl_Position=projectionMatrix*p;}`,
 fragmentShader:`varying float across,coverage,illum,tip;varying vec3 hue;
 void main(){gl_FragColor=vec4(hue*(.63+.56*illum)*(.80+.23*tip),coverage*(1.-smoothstep(.56,1.,abs(across))));}`});
 const needles=new T.Mesh(g,needleMat);needles.renderOrder=2;needles.visible=false;scene.add(needles);
 return {update(camera,height){needles.visible=camera.position.distanceToSquared(V(-24,35,777))<110*110;needleMat.uniforms.heightPixels.value=height;}};
}
