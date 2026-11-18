import * as T from "three";

export const mix=(a,b,t)=>a+(b-a)*t;
export const sat=x=>Math.min(1,Math.max(0,x));
export const step=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t);};
export function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const random=rng(418737),table=Float32Array.from({length:65536},()=>random()*2-1);
export function noise(x,y,planes=false){
  const i=Math.floor(x),j=Math.floor(y),xi=i&255,yi=(j&255)<<8,x1=(i+1)&255,y1=((j+1)&255)<<8;
  let u=x-i,v=y-j;
  const a=table[yi+xi],b=table[yi+x1],c=table[y1+xi],d=table[y1+x1];
  if(planes)return u+v<1?a+u*(b-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(b-d);
  u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(a,b,u),mix(c,d,u),v);
}
function line(keys,x){
  let a=0,b=keys.length-1;while(b-a>1){const m=(a+b)>>1;if(keys[m][0]>x)b=m;else a=m;}
  return mix(keys[a][1],keys[b][1],sat((x-keys[a][0])/(keys[b][0]-keys[a][0])));
}
const skyline=[[-740,129],[-560,178],[-471,241],[-446,268],[-425,350],[-408,389],[-372,410],[-363,428],[-329,435],[-308,452],[-275,459],[-250,479],[-237,480],[-211,474],[-174,467],[-127,464],[-90,474],[-41,480],[-13,485],[10,494],[36,492],[82,480],[105,470],[145,463],[194,466],[218,459],[228,455],[237,448.6],[242,447],[246,448.7],[251,457],[258,464],[278,473],[311,478],[366,479],[406,477],[459,463],[560,441],[751,367]];
export const crest=x=>line(skyline,x)+2.9*noise(x/12,24)+1.52*noise(x/4.1,86,true)+.46*noise(x/1.5,17,true);
// Individual detached sheets are described by their outcrop boundaries in the cliff plane.
// A steep free face and a longer feathered edge give exfoliation its asymmetric profile.
const plates=[];
function sheet(boundary,depth,tilt,bevel=2.1){
  const pts=boundary.map(([x,y])=>[x-450,506-y]);
  const xx=pts.map(v=>v[0]),yy=pts.map(v=>v[1]);
  plates.push({id:plates.length,pts,depth,tilt,bevel,left:Math.min(...xx),right:Math.max(...xx),bottom:Math.min(...yy),top:Math.max(...yy)});
}
sheet([[14,324],[42,128],[86,81],[135,55],[122,149],[71,276]],20,-.10,3.9);
sheet([[65,279],[107,107],[149,58],[193,32],[182,118],[134,228],[92,278]],24,-.15,2.9);
sheet([[135,324],[143,138],[192,79],[206,24],[237,25],[241,85],[220,234],[200,315]],26,-.22,2.5);
sheet([[202,343],[233,180],[245,100],[293,73],[321,74],[305,139],[269,246]],12,-.23);
sheet([[198,389],[220,316],[257,263],[283,206],[348,139],[393,89],[426,73],[388,163],[342,247],[304,293],[271,346]],25,.16,3.1);
sheet([[230,353],[264,288],[288,258],[330,192],[355,184],[324,244],[294,301]],7.5,.05,1.6);
sheet([[277,402],[300,325],[347,252],[387,162],[414,121],[436,110],[414,249],[383,346],[342,404]],18,-.18);
sheet([[376,416],[404,280],[427,164],[439,44],[452,14],[475,10],[470,196],[453,313],[431,380]],27,-.25);
sheet([[444,373],[462,260],[473,113],[488,18],[511,23],[501,163],[486,293],[471,365]],18,-.29,2.4);
sheet([[497,434],[512,323],[522,207],[534,120],[550,52],[569,46],[567,148],[549,265],[536,379]],13,-.16);
sheet([[554,402],[558,303],[581,248],[583,175],[617,116],[631,105],[618,232],[591,342]],14,-.21);
sheet([[601,377],[626,264],[635,195],[652,149],[662,127],[657,234],[643,310]],9,-.13);
sheet([[645,272],[650,190],[664,151],[669,107],[680,85],[678,161],[674,216]],8,-.31,1.4);
sheet([[694,271],[709,131],[718,97],[727,55],[767,32],[781,55],[758,145],[738,231]],27,-.23);
sheet([[724,265],[744,212],[791,193],[858,180],[880,166],[906,172],[904,238],[857,256],[812,258],[764,274]],23,-.13);
sheet([[711,405],[717,306],[741,284],[796,274],[858,268],[902,253],[911,391],[826,408]],34,-.11);
sheet([[119,389],[133,325],[159,312],[202,304],[215,297],[208,354],[192,374]],31,-.10,1.4);
// The headwall breaks into a staircase of detached lintels immediately west of the lip.
sheet([[518,89],[535,66],[581,62],[613,51],[631,51],[625,65],[594,82],[559,88],[532,113]],9,-.09,1.8);
sheet([[523,137],[544,121],[565,111],[591,105],[611,91],[611,101],[592,124],[561,132],[535,149]],11,.12,1.4);
sheet([[569,103],[581,87],[608,80],[636,66],[649,64],[639,81],[616,99],[589,105]],8,-.2,1.4);
sheet([[600,83],[615,70],[643,59],[660,54],[666,53],[663,65],[648,78],[623,82]],8,-.16,1.25);
sheet([[621,123],[629,104],[652,91],[671,85],[674,88],[662,107],[648,119]],6,.12,1.2);
sheet([[548,157],[554,150],[578,138],[593,125],[602,122],[596,134],[577,149],[555,160]],6,-.12,1.2);
sheet([[695,166],[711,129],[719,116],[729,113],[723,131],[712,170]],7,-.17,1.2);
sheet([[720,259],[741,242],[775,236],[795,228],[813,225],[802,235],[767,246],[739,259]],6,.12,1.0);
sheet([[746,408],[757,391],[786,384],[823,379],[850,366],[860,365],[846,382],[807,391],[773,400]],12,-.1,1.4);
function insideDistance(poly,x,y){
  let yes=false,d2=1e12;const p=poly.pts;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[j],b=p[i],vx=b[0]-a[0],vy=b[1]-a[1],dx=x-a[0],dy=y-a[1];
    if((a[1]>y)!==(b[1]>y)&&x<(vx*(y-a[1])/vy+a[0]))yes=!yes;
    const t=sat((dx*vx+dy*vy)/(vx*vx+vy*vy));
    d2=Math.min(d2,(dx-vx*t)**2+(dy-vy*t)**2);
  }
  return (yes?1:-1)*Math.sqrt(d2);
}
// A detached sheet is still part of its parent along one side. The free
// edge thickens across strike and the upper end pinches back into the mass.
function freeFace(layer,x,y){
 if(layer.id>13||layer.id===12)return 1;
 let left=1e5,right=-1e5;
 for(let i=0,j=layer.pts.length-1;i<layer.pts.length;j=i++){
   const a=layer.pts[i],b=layer.pts[j];
   if((a[1]>y)===(b[1]>y))continue;
   const cut=a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]);
   left=Math.min(left,cut);right=Math.max(right,cut);
 }
 if(right<=left+.3)return .40;
 const u=sat((x-left)/(right-left)),high=sat((y-layer.bottom)/(layer.top-layer.bottom));
 const face=layer.id===2||layer.id===7||layer.id===9||layer.id===13?1-u:u;
 const westSeam=.14+.86*face**.85;
 return westSeam*(1.-.33*step(.75,1.,high))*(.74+.26*step(.0,.17,high));
}
// Freshly uncovered sheets are paler and smoother than the old, varnished face.
export function exposureHistory(x,y){
 let main=0,broad=0;
 for(const i of [1,2,4,6,7,8,9,10,13]){
   const s=plates[i];
   if(x<s.left-2||x>s.right+2||y<s.bottom-2||y>s.top+2)continue;
   const d=insideDistance(s,x+.83*noise(x/14,y/24),y+1.1*noise(x/18,y/15+52));
   const fresh=step(-1.1,3.4,d);
   if(i===4)main=fresh;
   broad=Math.max(broad,fresh);
 }return [main,broad];
}
// Coarse, joint-bounded piers stand proud of the wall immediately below the
// snow shelf. Each has an almost planar face and a short undercut at its toe.
const piers=[
 [97,20,62,22,-.13],[118,14,41,16,-.27],[141,19,72,29,-.17],[166,12,32,14,-.21],
 [183,17,55,27,-.10],[207,13,47,23,-.24],[225,8,30,10,-.17],[261,16,61,25,-.19],[287,24,74,22,-.14]
];
// Long joint sets interrupt the batholith at different depths. A joint has a
// steep free face on its open side and a gently dipping roof behind it.
const jointGrid=new Map(),jointCellSize=40;
const jointKey=(i,j)=>(i+32)+96*(j+8);
function addJoint(x,y,dx,dy,rise,breadth,seed){
  const len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len;
  const margin=breadth+3;
  const joint={x,y,tx,ty,len,rise,breadth,seed};
  const ix0=Math.floor((Math.min(x,x+dx)-margin)/jointCellSize),ix1=Math.floor((Math.max(x,x+dx)+margin)/jointCellSize);
  const iy0=Math.floor((Math.min(y,y+dy)-margin)/jointCellSize),iy1=Math.floor((Math.max(y,y+dy)+margin)/jointCellSize);
  for(let j=iy0;j<=iy1;j++)for(let i=ix0;i<=ix1;i++){
    const key=jointKey(i,j);
    if(!jointGrid.has(key))jointGrid.set(key,[]);
    jointGrid.get(key).push(joint);
  }
}
const masterJoints=[
  [-429,178,142,98,13,31],[-376,196,84,61,9,19],[-319,204,118,81,16,28],[-269,301,81,58,9,16],
  [-243,164,48,103,12,24],[-237,188,62,87,8,18],[-174,287,94,114,11,24],[-94,281,65,116,15,29],
  [-61,194,87,79,11,24],[-21,149,105,85,16,32],[15,186,64,54,13,23],[64,226,64,50,11,22],
  [88,332,47,39,9,18],[102,357,41,23,13,19],[119,366,37,27,13,17],[129,370,48,34,11,19],
  [138,385,17,5,5.1,9],[142,382,44,31,13,19],[169,397,28,23,11,17],[186,408,25,21,11,14],
  [119,413,32,11,4.8,13],[156,418,20,11,5.1,11],[179,424,29,8,7.8,16],[196,429,27,13,6.4,11],
  [176,333,28,40,8,16],[194,356,22,32,9.4,16],[204,377,17,25,7.2,12],[240,371,42,28,9,18],
  [154,164,52,41,10,21],[145,135,38,28,12,25],[151,105,53,35,10,26],[184,145,33,22,5,17],
  [134,207,45,21,9.2,19],[163,223,41,25,10,22],[155,241,44,34,8,17],[180,231,33,33,7.5,18],
  [294,229,57,31,12,25],[331,248,62,26,9,21],[281,284,51,23,10,19],[268,367,58,63,8,19]
];
for(const [i,joint] of masterJoints.entries())addJoint(...joint,i*2.31+19.);
const jointRandom=rng(792017);
for(let i=0;i<495;i++){
 const x=-635+jointRandom()*1300,y=20+jointRandom()*458;
 const orientation=jointRandom(),bearing=orientation<.50?.46+.22*noise(x/97,y/125):orientation<.84?1.28+.22*noise(x/116,y/91):-.20+.24*noise(x/100,y/143);
 const len=13+54*jointRandom()**1.5,mag=(2.5+.10*len)*(.56+.71*jointRandom());
 addJoint(x,y,len*Math.cos(bearing),len*Math.sin(bearing),mag*(jointRandom()>.18?1:-1),len*(.19+.29*jointRandom()),10.+jointRandom()*191.);
}
function jointRelief(x,y){
  const entries=jointGrid.get(jointKey(Math.floor(x/jointCellSize),Math.floor(y/jointCellSize)));
  let result=0;
  if(!entries)return result;
  for(const j of entries){
    const dx=x-j.x,dy=y-j.y,dist=dx*j.tx+dy*j.ty;
    if(dist<0||dist>j.len)continue;
    const fraction=dist/j.len,offset=dy*j.tx-dx*j.ty;
    if(offset < -3 || offset>j.breadth+2)continue;
    const drift=1.3*noise(dist/12+j.seed,j.seed,true)+.36*noise(dist/2.3+j.seed,71,true);
    const across=offset+drift;
    const roof=1-sat(Math.max(0,across)/j.breadth);
    const wedge=step(-.92,.52,across)*roof;
    const end=step(0,.16,fraction)*(1-step(.78,1,fraction));
    result+=j.rise*wedge*end*(1.+.12*noise(dist/11,j.seed+55,true));
  }return result;
}
// A section through the upper headwall resolves persistent joints into long,
// almost planar columns. They terminate against an oblique cross-fault below.
const upperSection=[[38,-24],[63,-20],[78,-17],[88,-8],[98,-4],[100,-15],[112,-8],[121,2],[124,-14],
 [135,-10],[146,-2],[148,-12],[157,-7],[173,1],[176,-10],[184,-8],[196,-1],[198,-15],
 [206,-10],[216,-6],[219,-22],[226,-24],[234,-36],[242,-40],[248,-23],[256,-14],
 [267,-4],[274,5],[276,-8],[289,-3],[300,6],[303,-5],[326,5],[348,-2]];
const lowerSection=[[65,-21],[91,-20],[111,-10],[116,-14],[129,-12],[143,-2],[146,-14],
 [169,-9],[182,-1],[185,-13],[204,-7],[216,-2],[220,-16],[229,-18],[252,-14]];
function headwall(x,y,down){
 const slip=.102*down+1.7*noise(x/57,y/48+17,true)+.53*noise(x/14+21,y/16,true);
 const cutX=x-slip;
 let z=line(upperSection,cutX)-.077*down+2.70*noise(x/39,y/67,true)+.67*noise(x/7.2,y/17.3+1,true);
 const first=y-365.-(x-139.)*.58-1.5*noise(x/13,21,true);
 const second=y-384.-(x-147.)*.43-.88*noise(x/8,53,true);
 z+= (1.-step(-1.1,.70,first))*6.7*step(90,134,x)*(1.-step(183,222,x));
 z+= (1.-step(-.74,.55,second))*3.6*step(141,161,x)*(1.-step(215,236,x));
 return z;
}
export function front(x,y,rimY=crest(x)){
  const w=noise(x/102+17,y/145),q=x-.105*y;
  let z=-13+21*noise(q/108,y/222+35,true)+11*noise((x+.21*y)/61+73,y/141,true)
    +5.2*noise((x-.17*y)/22,y/73+18,true)+1.8*noise((x+.29*y)/8.9,y/29+12,true);
  const px=x+2.8*noise(x/36,y/77)+.95*noise(x/9,y/14),py=y+3.5*noise(x/48,y/35+73)+1.2*noise(x/13+11,y/9);
  for(const f of plates){
    if(px<f.left-3||px>f.right+3||py<f.bottom-3||py>f.top+3)continue;
    const dist=insideDistance(f,px,py);
    const cross=px-(f.left+f.right)*.5-.23*(py-(f.top+f.bottom)*.5);
    const attachment=step(.16,.96,(py-f.bottom)/(f.top-f.bottom))*step(.23,.94,(px-f.left)/(f.right-f.left));
    z+=(f.depth+f.tilt*cross)*freeFace(f,px,py) * step(-1.6,f.bevel+attachment*28.+.9*step(-160,180,px)+6.5*(1-step(.03,.37,(py-f.bottom)/(f.top-f.bottom))),dist);
  }
  if(x>65&&x<335&&y>335){
    for(const [cx,half,span,thrust,dip] of piers){
      const down=rimY-y,along=(x-cx+dip*down)/half;
      if(Math.abs(along)>1.27||down>span+8)continue;
      const cut=Math.abs(along)+.10*noise(x/8+cx,y/10,true)+.042*noise(x/2.6,y/3.8,true);
      // Three intersecting fracture planes, one sharp lip and a broken foot.
      const face=thrust*(.80+.20*along-.10*Math.min(1,Math.max(0,down)/span));
      const flank=(1.-cut)*half*(along<0?3.2:4.8);
      const under=(span-down-along*5.7)*2.15;
      z+=Math.max(0,Math.min(face,flank,under));
    }
  }
  const gully=(x-235+.077*(449-y))/13.;
  z-=14*Math.exp(-gully*gully);
  const lower=225+.145*(x-236)+3.4*noise(x/34+62,12);
  z+=(1-step(lower-3,lower+1.5,y))*step(232,290,x)*29;
  z+=(1-step(lower-4,lower+1.5,y))*Math.exp(-((x-225)**2)/63)*8.1;
  z+=(1-step(87+.15*x,93+.15*x,y))*step(245,325,x)*9;
  const top=rimY-y,r=3.3+1.4*w,f=sat(top/r);
  const sector=step(63,150,x)*(1.-step(264,329,x));
  const structural=.22+sector*(.31+.17*(1.-step(325,449,y)));
  const down=rimY-y;
  const crownSector=step(61,102,x)*(1.-step(283,322,x))*step(317,382,y);
  const overlay=crownSector*(.24+.64*step(342,405,y))*(.63+.37*step(5.,23.,Math.abs(x-241.)));
  if(overlay>.0001)z=mix(z,headwall(x,y,down),overlay);
  const toeWall=step(92,135,x)*(1.-step(217,247,x))*step(69,101,y)*(1.-step(184,256,y));
  if(toeWall>.001){
    const strike=x-.19*(y-134.)+1.15*noise(x/38,y/26+74,true);
    const breakHeight=124.+.38*(x-158.)+2.5*noise(x/15,61,true);
    const form=line(lowerSection,strike)+.063*(y-127.)+(1.-step(-.9,.6,y-breakHeight))*6.8;
    z=mix(z,form,toeWall*.67);
  }
  return z+structural*jointRelief(x,y)-r*(1-Math.sqrt(f*(2-f)));
}
export function summit(x,d,atLip=crest(x)){
  const scour=step(0,17,d);
  const plateau=step(58,97,x)*(1.-step(281,330,x));
  const soften=plateau*step(3,56,d);
  const broad=soften>0?(crest(x-16)+2*atLip+crest(x+16))*.25:atLip;
  const landscape=mix(atLip,broad,.88*soften)+(.074-.047*plateau)*d
    +scour*((5.6-1.7*plateau)*noise(x/35,d/30,true)+(2.05-.75*plateau)*noise(x/10,d/13+32,true))
    +scour*5.7*Math.exp(-(((x-210)/25)**2+((d-36)/24)**2));
  const bed=crest(242)+.096*d+.14*noise(d/3,54);
  const along=x-242-.052*d,width=3.1+3.9*step(0,36,d);
  return mix(landscape,bed,Math.exp(-((along/width)**2))*(1-step(39,95,d)));
}
export const riverCenter=x=>648+23*Math.sin(x/121)+11*Math.sin(x/56)-35*Math.exp(-((x+100)**2)/2400);
export function westernRange(x,z){
 const spine=-159+21*noise(x/81,43,true)+6*noise(x/26,55,true);
 const crown=376+27*noise(x/154,62,true)+12*noise(x/52,40,true)+4.3*noise(x/11,91,true);
 const frontSlope=Math.max(0,z-spine),backSlope=Math.max(0,spine-z);
 const joints=7.5*noise((x+.39*z)/26,z/39+35,true)+2.1*noise(x/7+5,z/8,true);
 const height=crown-frontSlope*(.86+.27*noise(x/38+9,z/73,true))-.36*backSlope+joints;
 // The range dives behind the nearer granite buttress and meets the valley floor.
 const flank=step(-500,-361,x)*step(-99,52,z),apron=step(-8,85,z);
 return mix(height,-17.,Math.max(flank,apron));
}
export function ground(x,z){
  const river=riverCenter(x),bank=step(-4,19,Math.abs(z-river)-(49+7*Math.sin(x/93)));
  const foot=13+16*Math.exp(-((x-212)**2)/6800)+39*step(245,478,x)+36*Math.exp(-((x+290)**2)/7900);
  const angle=71*Math.exp(-Math.max(0,z+3)/126);
  const side=112*Math.exp(-(((x+394)/144)**2+((z-346)/211)**2))
    +145*Math.exp(-(((x+508)/145)**2+((z-203)/192)**2))*(1.+.13*noise(x/33+21,z/48,true));
  const apron=64*step(211,286,x)*Math.exp(-(((x-284)/78)**2+((z-4)/67)**2))*
     (1.+.14*noise(x/19+49,z/23,true)+.055*noise(x/7,z/8,true));
  return -2.7+bank*(6.5+apron+angle+foot*Math.exp(-Math.max(0,z-12)/86)+side
   +4.9*noise(x/42,z/51)+2.4*noise(x/15,z/17,true)+.85*noise(x/4.8,z/5.7));
}
export function makeCourse(){
  const x0=242,top=crest(x0)+.48,lip=front(x0,crest(x0))+.78,bench=225;
  const list=[];let forward=lip;
  for(let i=0;i<1000;i++){
    const drop=i*.5,y=top-drop,b=Math.max(0,bench-y);
    const x=x0-13*(1-Math.exp(-Math.sqrt(drop)/4.9))-.030*drop-.64*Math.sqrt(b)-5.3*(1-Math.exp(-b/9.6))+3.6*Math.exp(-(((y-bench-12)/19)**2));
    const z=lip+1.37*Math.sqrt(drop)+1.06*Math.sqrt(b);
    forward=Math.max(forward,front(x,y)+1.75,z);
    list.push(new T.Vector3(x,y,forward));
    if(y<ground(x,forward)+11.25)break;
  }
  return {list,top,bench,lip:list[0],hit:list.at(-1)};
}
export function grid(nx,ny,point,flip=false){
  const vert=new Float32Array(nx*ny*3),uv=new Float32Array(nx*ny*2);
  const indices=new (nx*ny>65535?Uint32Array:Uint16Array)((nx-1)*(ny-1)*6);
  let k=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const id=j*nx+i,u=i/(nx-1),v=j/(ny-1);vert.set(point(u,v,i,j),id*3);uv.set([u,v],id*2);
    if(i+1<nx&&j+1<ny){const a=id,b=a+1,c=a+nx,d=c+1;indices.set(flip?[a,c,b,b,c,d]:[a,b,c,b,d,c],k);k+=6;}
  }
  const mesh=new T.BufferGeometry();mesh.setAttribute("position",new T.BufferAttribute(vert,3));mesh.setAttribute("uv",new T.BufferAttribute(uv,2));mesh.setIndex(new T.BufferAttribute(indices,1));mesh.computeVertexNormals();return mesh;
}
