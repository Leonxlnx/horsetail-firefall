import * as T from "three";
import {rng,mix,noise,ground,front,crest,summit,riverCenter,westernRange,step,grid} from "./batholith.js";
import {commonLight,stoneNoise,worldVertex,U} from "./granite.js";
import {crystalGL} from "./crystals.js";
import {rockReflectance} from "./reflectance.js";
const V=(x,y,z)=>new T.Vector3(x,y,z);
const groundFragment=`
varying vec3 world,normalW;varying vec2 mapUV;uniform float isSummit;
${stoneNoise}${commonLight}${crystalGL}
void main(){
 vec3 p=world,n=normalize(normalW);vec2 xy=p.xz;
 float drift=fb(xy/vec2(27.,19.)),basin=fb(xy/vec2(84.,62.)+29.),grit=vn(xy*2.6),speck=vn(xy*11.);
 float slope=n.y+.16*n.x+.45*(basin-.5)+.42*(drift-.5);
 float settle=smoothstep(.61,.78,slope+mix(.12,.060,isSummit));
 float scoured=smoothstep(.50,.74,fb(xy/vec2(13.,7.)+p.y*.054+17.)+.18*(1.-drift));
 settle*=1.-isSummit*.77*scoured*smoothstep(.34,.79,n.z+.53*n.x+.43);
 float wet=exp(-length((p-impact)*vec3(.88,1.,.94))/19.);
 settle*=1.-wet*.92;
 float occlusion=.60+.46*max(0.,dot(n,normalize(vec3(-.39,.83,.28))));
 vec3 snow=vec3(.486,.575,.704)*(.85+.15*drift+.10*grit)*occlusion;
 vec3 rock=mix(vec3(.108,.138,.178),vec3(.238,.254,.271),basin)*(.53+.53*occlusion)*(.84+.30*drift+.055*grit);
 vec4 quartz=grainSurface(p,n);vec3 bedN=grainNormal(n,quartz,.58);
 float breakage=triangular(xy/vec2(4.,2.)+p.y*.10),banding=fb(xy/vec2(3.4,12.)+p.y*.14);
 vec3 bedColor=mix(vec3(.13,.166,.215),vec3(.31,.34,.37),basin)*(.80+.44*banding)*(.78+.30*quartz.b+.19*breakage);
 bedColor*=.61+.69*max(0.,dot(bedN,normalize(vec3(-.67,.61,.34))));
 rock=mix(rock,bedColor,.68+.32*isSummit);
 vec3 c=mix(rock*(1.-wet*.38),snow,settle)*(.82+.30*day);
 float driftRidge=smoothstep(.50,.72,fb(xy/vec2(34.,12.)+23.));
 float lipGlow=isSummit*exp(-abs(p.x-176.)/95.)*smoothstep(.29,.96,-n.x+.38)*driftRidge;
 c+=sunColor()*amber*(.20*lipGlow+.16*wet)*max(0.,n.z+.2);
 if(isSummit>.5){
   float sun=eveningSun(p+n*.26)*max(0.,dot(n,normalize(vec3(-.99,.123,.108))));
   c+=sunColor()*amber*sun*(.38+.22*(1.-settle))*(.45+.55*drift);
 }
 c*=skyShadow(p+normalize(n)*.29);c+=(speck-.5)*.010;gl_FragColor=vec4(atmosphere(c,p),1.);
}`;
function block(seed,detail){
 // Each block is the closed intersection of a distinct family of joint planes.
 // Triple intersections recover the sharp broken faces, including their real rims.
 const random=rng(seed),planes=[],vertices=[],positions=[],normals=[];
 const add=(a,b,c,d)=>planes.push({n:V(a,b,c).normalize(),d,corners:[]});
 add(1,.10+random()*.20,.12,.70+random()*.14);add(-1,-.12,.16,.74+random()*.13);
 add(.11+random()*.19,1,-.21,.54+random()*.17);add(-.12,-1,.16,.62+random()*.13);
 add(.23,.11,1,.73+random()*.16);add(-.13,.22,-1,.75+random()*.12);
 for(let i=0;i<12;i++)add(random()-.5,random()-.5,random()-.5,.66+.31*random());
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
   const a=planes[i],b=planes[j],c=planes[k],bc=b.n.clone().cross(c.n),det=a.n.dot(bc);
   if(Math.abs(det)<.00001)continue;
   const q=bc.multiplyScalar(a.d).addScaledVector(c.n.clone().cross(a.n),b.d)
     .addScaledVector(a.n.clone().cross(b.n),c.d).divideScalar(det);
   if(planes.some(v=>v.n.dot(q)>v.d+.00003))continue;
   if(!vertices.some(v=>q.distanceToSquared(v)<.00000001))vertices.push(q);
 }
 const divisions=detail>3?6:3;
 function vertex(q,face){
   const radial=q.clone().normalize(),ground=1.+.049*noise(q.x*3.7+seed+q.z*.74,q.y*4.2+q.z*2.1,true)
     +.021*noise(q.z*9.2+seed,q.x*10.6+q.y*.79,true);
   const p=q.clone().multiplyScalar(ground),n=face.n.clone();
   for(const other of planes){
     if(other===face)continue;
     const edge=other.d-other.n.dot(q);
     if(edge<.037)n.addScaledVector(other.n,.56*(1.-Math.max(0,edge)/.037));
   }
   n.normalize().lerp(radial,.06).normalize();
   positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
 }
 for(const face of planes){
   const corners=vertices.filter(q=>Math.abs(q.dot(face.n)-face.d)<.00007);
   if(corners.length<3)continue;
   const center=V(0,0,0);for(const q of corners)center.add(q);center.divideScalar(corners.length);
   const axis=corners[0].clone().sub(center).normalize(),up=face.n.clone().cross(axis);
   const angle=q=>{const v=q.clone().sub(center);return Math.atan2(v.dot(up),v.dot(axis));};
   corners.sort((a,b)=>angle(a)-angle(b));
   for(let k=0;k<corners.length;k++){
     const a=corners[k].clone().sub(center),b=corners[(k+1)%corners.length].clone().sub(center);
     const sample=(i,j)=>center.clone().addScaledVector(a,i/divisions).addScaledVector(b,j/divisions);
     for(let i=0;i<divisions;i++)for(let j=0;j<divisions-i;j++){
       const q=sample(i,j),r=sample(i+1,j),s=sample(i,j+1);
       vertex(q,face);vertex(r,face);vertex(s,face);
       if(i+j<divisions-1){vertex(r,face);vertex(sample(i+1,j+1),face);vertex(s,face);}
     }
   }
 }
 const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
 g.setAttribute("normal",new T.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;
}
// Glacial abrasion rounds summit tors while leaving angular low joints.
function tor(seed){
 const mesh=new T.SphereGeometry(1,36,22),p=mesh.getAttribute('position'),q=new T.Vector3();
 for(let i=0;i<p.count;i++){
   q.fromBufferAttribute(p,i);
   const u=q.x,v=q.y,w=q.z;
   const err=.078*noise(u*4.5+seed,w*3.9+v*1.8,true)+.035*noise(w*7.2,v*8.1+seed,true);
   const radius=.93+err;
   const cap=Math.sign(v)*Math.abs(v)**.81;
   p.setXYZ(i,radius*u*(1.-.09*v)+.088*v,cap*.84*(1.+.10*u)+err*.20,radius*w*(.88+.05*v));
 }
 mesh.computeVertexNormals();mesh.computeBoundingSphere();return mesh;
}
const blockVS=`uniform vec3 impact;varying vec3 world,norm;varying float localY,variant;
void main(){mat3 basis=mat3(instanceMatrix);norm=normalize(basis*(normal/vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]))));
 vec4 p=instanceMatrix*vec4(position,1.);
 float extent=(length(basis[0])+length(basis[2]))*.5,wetness=exp(-distance(p.xyz,impact)/24.);
 float accumulation=smoothstep(.61,.94,norm.y+.13*position.y);
 p.y+=min(.39,.040*extent)*accumulation*(1.-wetness);
 world=p.xyz;localY=position.y;variant=fract(instanceMatrix[3].x*.173);gl_Position=projectionMatrix*viewMatrix*p;}`;
const blockFS=`varying vec3 world,norm;varying float localY,variant;${stoneNoise}${commonLight}${crystalGL}
void main(){vec3 n=normalize(norm),p=world;vec2 q=p.xy+vec2(.38,-.25)*p.z;
 float grains=triangular(q*1.9),band=fb(q/5.9),chips=vn(q*7.8);
 vec4 crystal=grainSurface(p*1.7,n);n=grainNormal(n,crystal,.79);float wet=exp(-length(p-impact)/24.);
 float dust=smoothstep(.60,.77,n.y+.22*localY+(band-.5)*.55+(grains-.5)*.27+(variant-.5)*.28-.67*wet);
 float sk=.30+.53*max(0.,dot(n,normalize(vec3(-.71,.68,.26))))+.24*max(0.,n.y)+.15*max(0.,n.z);
 vec3 col=mix(vec3(.113,.143,.183),vec3(.235,.249,.272),variant*.40+band*.60)*(.65+.47*sk)*(.81+.29*band+.08*chips)*(1.-.44*wet);
 col=mix(col,vec3(.47,.55,.68)*(.69+.32*sk)*(.92+.13*grains),dust);
 vec3 view=normalize(cameraPosition-p),toward=normalize(impact+vec3(0.,14.,.0)-p);float spec=pow(max(0.,dot(n,normalize(view+toward))),8.);
 col+=sunColor()*amber*wet*(.11*max(0.,dot(n,toward))+.51*spec);
 if(p.y>367.)col+=sunColor()*amber*eveningSun(p+normalize(norm)*.24)*max(0.,dot(n,normalize(vec3(-.99,.123,.108))))*(.25+.23*grains);
 col*=skyShadow(p+normalize(norm)*.21)*(.77+.45*crystal.b);
 gl_FragColor=vec4(atmosphere(col*(.86+.29*day),p),1.);}`;
export function valleyFloor(scene,u,course,stone,ledgeRubble=[]){
 const make=(g,mat)=>{const m=new T.Mesh(g,mat);scene.add(m);return m;};
 const terrainMat=isSummit=>new T.ShaderMaterial({uniforms:{...u,isSummit:{value:isSummit}},vertexShader:worldVertex,fragmentShader:groundFragment,side:T.DoubleSide});
 const rangeMaterial=terrainMat(0);
 rangeMaterial.fragmentShader=groundFragment.replace('gl_FragColor=vec4(atmosphere(c,p),1.);',
   'c=mix(c*vec3(.91,1.08,1.31),vec3(.38,.50,.70),.20);gl_FragColor=vec4(atmosphere(c,p),1.);');
 make(grid(264,126,(u,v)=>{const x=-1180+u*820,z=-335+v*420;
   return [x,westernRange(x,z),z];},true),rangeMaterial);
 make(grid(371,257,(u,v)=>{const x=mix(-910,910,u),z=mix(-35,1100,v);return [x,ground(x,z),z];},true),terrainMat(0));
 const roofline=Array.from({length:1003},(_,i)=>{const x=mix(-692,692,i/1002),y=crest(x);return [x,y,front(x,y,y)];});
 const lid=grid(1003,107,(u,v,i)=>{const [x,y,z]=roofline[i],d=v*190;return [x,summit(x,d,y),z-d];});
 const roofMat=terrainMat(1);roofMat.uniforms.relief=U(stone.bed.texture);roofMat.uniforms.macroField=U(stone.base);
 roofMat.vertexShader='uniform sampler2D relief,macroField;'+worldVertex.replace('normalW=mat3',`float d=uv.y*190.;float crown=texture2D(macroField,atlasUV(vec2(world.x,0.))).g;vec2 lipUV=atlasUV(vec2(world.x,crown));
 world.z+=(texture2D(relief,lipUV).r-texture2D(macroField,lipUV).r)*(1.-smoothstep(0.,11.,d));normalW=mat3`);
 make(lid,roofMat);
 const ridgeMat=new T.ShaderMaterial({uniforms:{...u,bedRock:U(stone.bed.texture),macro:U(stone.base)},side:T.DoubleSide,
  vertexShader:`varying vec3 world,normalW;varying vec2 mapUV;uniform sampler2D bedRock,macro;void main(){world=position;mapUV=(world.xy-vec2(-695.,-28.))/vec2(1390.,565.);
    world.z+=texture2D(bedRock,mapUV).r-texture2D(macro,mapUV).r;normalW=normal;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
  fragmentShader:`varying vec3 world,normalW;varying vec2 mapUV;`+stoneNoise+commonLight+`
   void main(){vec3 n=normalize(normalW);float grit=fb(world.xz*1.6+world.xy*.25),horizon=.72+.28*max(0.,n.y);
    vec3 snow=vec3(.46,.57,.73)*horizon*(.83+.24*grit);
    float sun=max(.0,dot(n,normalize(vec3(-.93,.24,.10))))*smoothstep(.26,.63,fb(world.xy/vec2(10.,5.)));
    snow+=sunColor()*sun*amber*.43;gl_FragColor=vec4(atmosphere(snow,world),1.);}`});
 // Small intermittent cornices wrap the brink. Their lee lips turn down over
 // the granite and show snow depth when seen from below.
 for(const [x0,len,seed] of [[95,12,8],[115,16,6],[139,9,4],[153,15,3],[173,7,10],[185,11,5],[201,13,11],[219,9,12],[232,4,6],[260,8,9],[276,13,3]]){
   make(grid(Math.ceil(len*3.5),12,(u,v)=>{
     const x=x0+u*len,taper=Math.sin(Math.PI*u)**.68,b=1.3+.60*noise(x/3.+seed,28);
     const a=1.74*v-.61,base=crest(x),z=front(x,base);
     return [x,base+(.05+.48*taper)*Math.cos(a*Math.PI/1.98)-Math.max(0,a-.42)*b*.91,z+(a*b)*taper-.1];
   },true),ridgeMat);
 }
 const r=rng(73614),mat=new T.ShaderMaterial({vertexShader:blockVS,fragmentShader:blockFS,uniforms:u});
 const store=Array.from({length:11},()=>new Map()),dummy=new T.Object3D();
 function place(k,x,y,z,s,sx,sy,sz,spin,tip){
   dummy.position.set(x,y,z);dummy.scale.set(s*sx,s*sy,s*sz);dummy.rotation.set(tip,spin,(r()-.5)*.49);
   dummy.updateMatrix();const key=Math.floor(x/126)+","+Math.floor(z/106),cells=store[k];
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(dummy.matrix.clone());
 }
 for(const [x,y,z,s] of ledgeRubble)place(Math.floor(r()*6),x,y-s*.12,z,s,1.4,.58,.92,r()*6.28,.05);
 const hit=course.hit;
 // A bedrock boss interrupts the flow. Its wet summit is shared with
 // the spray emitter and the first metres of the three draining runnels.
 function boss(x,z){
   const dx=x-hit.x,dz=z-hit.z,along=dz-.31*dx,cross=dx+.29*dz;
   const crown=hit.y-.04-.075*cross-.115*along;
   const west=hit.y+3.60+.68*cross-.36*along;
   const near=hit.y+4.35-.96*along+.17*cross;
   const shoulder=hit.y+6.9-.52*along-.97*cross;
   const joint=hit.y+11.8-1.31*along-.21*cross;
   const footing=hit.y+18.6+1.73*cross+.16*along;
   const rear=hit.y+7.4+1.22*along+.13*cross;
   const downhill=hit.y+7.2-1.94*along+.10*cross;
   const returnFace=hit.y+5.3+.42*cross-1.35*along;
   const plane=Math.min(crown,west,near,shoulder,joint,footing,rear,downhill,returnFace);
   const relief=1.48*noise(cross/4.9,along/6.8,true)+.68*noise(cross/2.2,along/2.9+27,true)+.21*noise(cross/1.2,along/.96+69,true);
   const split=.84*step(-.19,.27,along+.42*cross-6.3)*step(1.4,3.1,cross+12.);
   const grain=(relief-split)*step(.55,4.6,Math.hypot(dx,dz));
   const floor=ground(x,z);
   return Math.max(floor-2.2,plane+grain);
 }
 const gBoss=grid(118,121,(u,v)=>{const x=hit.x+62*(u-.5),z=hit.z-20.+64*v;return [x,boss(x,z),z];},true);
 const posBoss=gBoss.getAttribute('position'),uncovered=new Float32Array(posBoss.count);
 for(let i=0;i<uncovered.length;i++)uncovered[i]=posBoss.getY(i)-ground(posBoss.getX(i),posBoss.getZ(i));
 gBoss.setAttribute('uncovered',new T.BufferAttribute(uncovered,1));
 const polished=new T.ShaderMaterial({uniforms:u,side:T.DoubleSide,
   vertexShader:'attribute float uncovered;varying float ledgeHeight;'+worldVertex.replace('world=(modelMatrix','ledgeHeight=uncovered;world=(modelMatrix'),
   fragmentShader:`varying vec3 world,normalW;varying vec2 mapUV;varying float ledgeHeight;uniform float clockTime;`+commonLight+stoneNoise+crystalGL+rockReflectance+`
    void main(){if(ledgeHeight<.14)discard;vec3 p=world,n=normalize(normalW);vec2 local=p.xz-impact.xz;
      vec2 q=vec2(local.x+.41*local.y,local.y);
      vec2 stoneUV=mix(p.xy+vec2(.25,-.18)*p.z,p.xz+p.y*.17,smoothstep(.30,.77,n.y));
      float glaze=fb(vec2(stoneUV.x*.69+vn(stoneUV/2.4),stoneUV.y*.17)+13.);
      float groove=triangular(q/vec2(.26,.81)+p.y*.17);
      vec4 grain=grainSurface(p,n);vec3 skin=grainNormal(n,grain,.55);
      vec3 color=mix(vec3(.061,.086,.112),vec3(.137,.154,.167),glaze)*(.65+.44*max(0.,skin.y))*(.84+.34*grain.b);
      color=weatheredRock(color,p,skin,n,.85,0.,.1,.96,.25+.26*grain.b,amber,red);
      vec3 view=normalize(cameraPosition-p);vec3 L=normalize(impact+vec3(0.,8.,.6)-p);
      float directed=ggxLight(skin,view,L,.22,.037,.22)*min(1.,5./max(1.,length(p-impact)));
      color+=sunColor()*amber*(.49*sqrt(min(1.,directed))+.20*glaze*pow(max(0.,dot(skin,L)),3.))*exp(-length(local)/17.);
      float running=local.x+.51*local.y+.20*sin(1.5*local.y);
      float rivulets=exp(-abs(running)/.39)+.78*exp(-abs(running+local.y*.30-1.0)/.58)
        +.63*exp(-abs(running-local.y*.27+.84)/.44);
      float sheet=exp(-abs(running)/3.25)*smoothstep(-2.3,.45,local.y)*exp(-length(local)/14.);
      float ripple=fb(vec2(running*3.1,local.y*1.58-clockTime*1.72));
      float high=.22+.78*smoothstep(.35,.67,glaze+.22*(groove-.5)+.28*(ripple-.5));
      color+=sunColor()*amber*(sheet*(.12+.28*high)+min(1.,rivulets)*(.11+.21*high)*exp(-length(local)/13.));
      float rim=exp(-length(local*vec2(.64,.88))/5.);
      color+=sunColor()*amber*rim*(.095+.11*max(0.,skin.y));
      float cleavage=triangular(stoneUV/vec2(2.3,4.9)+.53*fb(stoneUV/24.));
      float zenith=max(0.,dot(skin,normalize(vec3(-.73,.58,.35))));
      color+=vec3(.078,.095,.118)*(.21+.72*zenith)*(.22+.89*cleavage);
      color+=vec3(.031,.044,.053)*grain.b*(.3+.7*zenith);
      color*=.87+.17*groove+.12*triangular(stoneUV*1.73);gl_FragColor=vec4(atmosphere(color,p),1.);
    }`});
 make(gBoss,polished);
 // An intact outcrop takes the impact. Its upstream shoulder rises above the loose talus.
 for(const [dx,dz,s,sy,yaw] of [[-2,1,8.7,.70,.36],[6,-1,6.9,.89,1.09],[-8,6,8.3,.85,-.66],[-13,9,5,.68,1.43],[12,1,4.5,.76,2.12]]){
   const x=hit.x+dx,z=hit.z+dz;place(6,x,ground(x,z)-s*.25,z,s,1.46,sy,1.01,yaw,.13);
 }
 // Companion blocks bury the toe of the slab and catch reflected light on
 // their wet upper faces before the water reaches the smaller talus.
 for(const [dx,dz,size,yaw,sx,sy] of [[-8,8,7.8,.74,1.32,.72],[-4,13,6.7,-.32,1.46,.71],
   [2,15,7.3,.81,1.28,.80],[8,11,5.3,-.21,1.31,.68],[-12,5,6.1,.53,1.44,.72],[12,4,5.4,1.17,1.28,.75]]){
   const x=hit.x+dx,z=hit.z+dz,y=Math.max(ground(x,z)+size*.09,boss(x,z)-size*.33);
   place(6,x,y,z,size,sx,sy,1.05,yaw,.17);
 }
 for(let i=0;i<370;i++){
   const x=hit.x+(r()-.5)*42.,z=hit.z+(r()-.18)*38.;
   const length=.16+.93*r()**2.1,radius=Math.hypot((x-hit.x)/15.,(z-hit.z)/12.);
   if(radius<.86||radius>1.78||boss(x,z)>ground(x,z)+2.4)continue;
   place(i%6,x,Math.max(ground(x,z),boss(x,z))-.18*length,z,length,1.32,.62,1.03,r()*6.28,.18);
 }
 // A low, snow-covered spit extends across the near-left bank at river level.
 const shore=(x,z)=>{
   const d=((x+52.)/17.)**2+((z-674.+(x+52.)*.37)/8.2)**2;
   return -.87+4.9*Math.exp(-d*.85)+.76*noise(x/3.1,z/3.9,true)*Math.exp(-d);
 };
 make(grid(69,45,(u,v)=>{const x=-99+u*91,z=639+v*80;return [x,shore(x,z),z];},true),terrainMat(0));
 for(let i=0;i<70;i++){
   const x=-66+r()*31,z=669+r()*13,s=.26+r()**2*2.7;
   place(3+i%3,x,shore(x,z)-s*.33,z,s,1.34,.75,.92,r()*6.28,.15);
 }
 // Willow whips along the waterline interrupt the snowbanks and their reflection.
 const willow=[],branchColors=[];
 function twig(a,b,rad){
   const d=b.clone().sub(a).normalize(),side=d.clone().cross(V(0,0,1)).normalize();
   const back=d.clone().cross(side),t=.70+r()*.27;
   for(let j=0;j<3;j++){
     const n=side.clone().multiplyScalar(Math.cos(j*2.094)).addScaledVector(back,Math.sin(j*2.094));
     const m=side.clone().multiplyScalar(Math.cos((j+1)*2.094)).addScaledVector(back,Math.sin((j+1)*2.094));
     const aa=a.clone().addScaledVector(n,rad),ab=a.clone().addScaledVector(m,rad);
     const ba=b.clone().addScaledVector(n,rad*.42),bb=b.clone().addScaledVector(m,rad*.42);
     for(const v of [aa,ab,ba,ab,bb,ba]){willow.push(v.x,v.y,v.z);branchColors.push(.165*t,.159*t,.17*t);}
   }
 }
 for(let i=0;i<460;i++){
   const x=(r()-.46)*750,sign=r()>.72?1:-1;
   const z=riverCenter(x)+sign*(54+8*Math.sin(x/93)+r()*16);
   if(noise(x/18,z/16+171)<-.1)continue;
   const y=Math.max(ground(x,z),x> -81&&x< -29&&z>655&&z<695?shore(x,z):-4.);
   if(y<1.53)continue;
   for(let j=0;j<8;j++){
     const root=V(x+r()*.85,y-.06,z+r()*.65),height=.6+2.9*r()**1.4;
     const end=root.clone().add(V((r()-.5)*height,height,(r()-.5)*height));
     const fork=root.clone().lerp(end,.54);twig(root,fork,.026+.014*height);twig(fork,end,.016+.008*height);
     const tip=fork.clone().add(V((r()-.5)*.8,.21+.51*height,(r()-.5)*.76));
     twig(fork,tip,.012+.005*height);
   }
 }
 const scrub=new T.BufferGeometry();scrub.setAttribute("position",new T.Float32BufferAttribute(willow,3));scrub.setAttribute("color",new T.Float32BufferAttribute(branchColors,3));scrub.computeBoundingSphere();
 make(scrub,new T.ShaderMaterial({vertexColors:true,vertexShader:"varying vec3 c;void main(){c=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec3 c;void main(){gl_FragColor=vec4(c,1.);}",side:T.DoubleSide}));
 for(let i=0;i<880;i++){
   const x=(r()-.50)*900,side=r()>.53?1:-1;
   const offset=side*(49+7*Math.sin(x/93)+r()**1.8*18.-6.);
   const z=riverCenter(x)+offset,s=.24+1.9*r()**2.6;
   if(noise(x/24+211,z/24)<-.40)continue;
   place(Math.floor(r()*6),x,ground(x,z)+s*.15,z,s,1.35,.57,1.,r()*6.28,0);
 }
 // Companion blocks bury the toe of the slab and catch reflected light on
 // their wet upper faces before the water reaches the smaller talus.
 for(const [dx,dz,size,yaw,sx,sy] of [[-8,8,7.8,.74,1.32,.72],[-4,13,6.7,-.32,1.46,.71],
   [2,15,7.3,.81,1.28,.80],[8,11,5.3,-.21,1.31,.68],[-12,5,6.1,.53,1.44,.72],[12,4,5.4,1.17,1.28,.75]]){
   const x=hit.x+dx,z=hit.z+dz,y=Math.max(ground(x,z)+size*.09,boss(x,z)-size*.33);
   place(6,x,y,z,size,sx,sy,1.05,yaw,.17);
 }
 for(let i=0;i<370;i++){
   const x=hit.x+6.+r()**.75*83.,z=hit.z-13.+r()*60.;
   const s=1.15+7.7*r()**2.2;
   if(z<front(x,ground(x,z))+.20*s)continue;
   place(6+i%3,x,ground(x,z)-s*.21,z,s,1.05+r()*.76,.64+r()*.43,.88+r()*.37,.4+r()*2.3,-.06+r()*.19);
 }
 for(let i=0;i<52;i++){
   const a=r()*6.28,d=6.+r()*42.,x=hit.x+Math.cos(a)*d,z=hit.z+Math.sin(a)*d*.75;
   const s=2.3+r()**1.4*7.5;place(6+i%3,x,ground(x,z)-s*.16,z,s,1.23,.74,1.,r()*6.28,.11);
 }
 for(let i=0;i<11800;i++){
   let x,z,s;
   if(i<4450){x=hit.x+(r()-.47)*168;z=hit.z+(r()-.14)*102;s=.23+4.1*r()**3.8;}
   else if(i<7490){x=(r()-.50)*1370;z=14+r()**1.8*223;s=.5+r()**3.2*9.8;}
   else {x=(r()-.50)*1390;z=34+r()*753;s=.38+r()**3.1*6.5;}
   const y=ground(x,z);if(z<front(x,y)+s*.71||y<1&&s<2.4)continue;
   const slope=Math.atan2(ground(x,z-1)-ground(x,z+1),2);
   place(Math.floor(r()*6),x,y-.28*s,z,s,.70+r()*.95,.66+r()*.55,.71+r()*.69,r()*6.283,slope*.70);
 }
 // Broken domes protrude through the wind-scoured plateau above the brink.
 for(const [x,d,s,sx,sy,sz,yaw] of [[188,21,8.,1.7,.79,.96,.41],[213,38,13.3,1.52,.76,.99,-.41],
   [215,34,8.4,1.21,.81,1.04,.30],[219,26,5.3,1.4,.67,.88,-.13],[197,32,7.7,1.20,.63,1.13,.18],
   [264,46,7.6,1.35,.78,.89,-.24],[273,49,6.2,1.4,.75,1.,.34],[283,43,9.6,1.42,.65,1.,.42],
   [151,15,8.9,1.51,.64,.98,.12],[162,11,5.4,1.62,.70,.81,-.61],[128,17,7.2,1.9,.67,.94,.34],
   [104,14,6.4,1.72,.65,1.15,-.56],[101,32,8.6,1.72,.69,1.15,-.43],[180,8,4.7,1.48,.70,.89,.18]]){
   place(9+Math.floor(r()*2),x,summit(x,d)-s*(d<26?.39:.25),front(x,crest(x))-d,s,sx,sy,sz,yaw,.12);
 }
 for(let i=0;i<430;i++){
   const x=(r()-.5)*944,d=8+r()*97,s=.4+4.6*r()**2;
   if(Math.abs(x-242)<10||Math.abs(summit(x+1,d)-summit(x-1,d))>1.8)continue;
   place(6+Math.floor(r()*3),x,summit(x,d)-.30*s,front(x,crest(x))-d,s,1.15,.67,.95,r()*6.28,0);
 }
 for(let k=0;k<store.length;k++){
   const g=k<9?block(k*523+31,k<6?2:5):tor(k*83);
   for(const matrices of store[k].values()){
     const m=new T.InstancedMesh(g,mat,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.computeBoundingSphere();scene.add(m);
   }
 }
}
