import * as T from "three";
import {rng,noise,front,crest} from "./batholith.js";
import {cliffFragment} from "./granite.js";

export function detachedGranite(scene,uniforms){
 const r=rng(716230),plants=[],scree=[];const P=[],N=[],age=[],lip=[];
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 function tri(a,b,c,s,type){const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
   for(const v of [a,b,c]){P.push(v.x,v.y,v.z);N.push(n.x,n.y,n.z);age.push(s);lip.push(type);}
 }
 function block(x,y,w,h,reach,rot,top=false){
   const seed=r()*351,dr=r()*.45+.5,angle=rot+.063*(r()-.5),dx=Math.cos(angle),dy=Math.sin(angle);
   const tilt=.5-r(),p=[[-.46,-.48],[-.51,-.23],[-.48,.31],[-.33,.50],[.16,.53],[.44,.43],[.47,.20],[.37,-.28],[.13,-.47],[-.24,-.52]];
   const sign=top?1:0;
   function vertex(u,v,f){
     const xx=x+u*w*dx-v*h*dy,yy=y+v*h*dx+u*w*dy;
     const potential=front(xx,yy);
     const bump=noise(xx/5+seed,yy/7,true)*.65+noise(xx/2,yy/2+seed,true)*.27;
     const mask=top?1:Math.max(.2,.78+v*.65+u*.25);
     return V(xx,yy,potential+reach*(f*mask+.13*tilt*u+.18*tilt*v)+bump);
   }
   const rings=[];
   for(const [scale,f] of [[1,-.48],[1.025,.18],[.92,.86],[.72,.97],[.36,1.0]]){
     rings.push(p.map(([u,v])=>vertex(u*scale,v*scale,f)));
   }
   const tone=.29+.52*r();
   for(let k=0;k<rings.length-1;k++)for(let j=0;j<p.length;j++){
     const f=(j+1)%p.length,a=rings[k][j],b=rings[k][f],c=rings[k+1][j],d=rings[k+1][f];
     // Adaptive intermediate points keep a long plate from bridging a deep joint.
     const facet=tone+.15*noise(k+seed,j+3);
     tri(a,c,b,facet,sign);tri(c,d,b,facet,sign);
   }
   const mid=vertex(0,0,1.04);for(let j=0;j<p.length;j++)tri(rings.at(-1)[j],mid,rings.at(-1)[(j+1)%p.length],tone,sign);
 }
 // Prominent fractured buttresses that bound the notch. Steps grow out of a
 // common face and pinch out across strike.
 for(const [x,under,w,h,d,rot] of [[115,27,13,36,4.4,-.12],[129,19,18,32,5.0,-.08],[145,21,14,38,3.6,-.09],[160,27,13,45,4.7,-.16],[174,15,11,26,4.5,.03],[191,14,14,25,4.1,-.11],[206,24,13,43,3.1,-.11],[218,13,11,22,3.5,-.20],[226,10,7,17,3.6,-.12],[258,14,11,25,5.3,-.13],[265,18,15,32,5.6,-.15],[278,22,13,40,4.4,-.04]]){
   block(x,crest(x)-under,w,h,d*.42,rot,true);
 }
 // Most exfoliation is continuous with the parent face. Only broken toes of
 // sheets and the detached summit lintels have genuinely undercut geometry.
 for(const [x,y,w,h,d,t] of [[-151,205,11,37,2.1,-.52],[-177,180,8,34,2.2,-.54],[-111,266,10,39,3,-.47],
   [112,366,9,25,2.7,-.3],[153,390,9,35,2.2,-.3],[176,309,6,17,2.1,-.25],[195,189,7,29,2.5,-.29]]){
   block(x,y,w,h,d,t);
 }
 // Snow lies on the broken upper surfaces of the two eastern terraces. The
 // projecting noses, lee slopes and undersides all have finite depth.
 function shelf(nodes,salt,reach=1){
   const rows=[];
   for(let j=0;j<nodes.length-1;j++)for(let k=0;k<11;k++){
     const a=nodes[j],b=nodes[j+1],f=k/11,x=a[0]+(b[0]-a[0])*f;
     const y=a[1]+(b[1]-a[1])*f+1.15*noise(x/8,salt,true)+.5*noise(x/3.,salt+9,true);
     const along=(j+f)/(nodes.length-1),taper=Math.sin(Math.PI*along)**.58,horizon=front(x,y);
     const projected=front(x,y-5),depth=(9.+5.6*noise(x/13,salt+19))*taper*reach;
     const nose=Math.max(horizon,projected)+depth,back=Math.min(horizon-5.,nose-9.);
     const thickness=(6.9+3.1*noise(x/17,salt))*taper*Math.min(1.,.20+reach);
     const row=[];
     for(const [offset,yy] of [[0,1.3],[.22,1.75],[.50,1.35],[.77,.78],[.93,.39],[1,-.69],[.94,-2.4],[.86,-thickness*.85],[.72,-thickness*1.2],[.0,-thickness*1.48]]){
       const z=back+(nose-back)*offset,v=y+yy+(yy>-.71?1-Math.min(1,offset):0)*depth*.94+noise(x/4.3,z/3.6+salt,true)*.68;
       row.push(V(x,v,z));
     }
     if(taper>.22){
       const spot=row[2+Math.floor(r()*3)];
       if(spot.z>front(spot.x,spot.y)+.34){
         if(reach>.4&&r()<.51&&x>nodes[0][0]+14){
           const h=.89+4.75*r()**1.7;plants.push([spot.x,spot.y-.08,spot.z,h]);
           if(r()<.32)plants.push([spot.x+.64,spot.y-.03,spot.z+.19,h*.54]);
         }
         if(reach>.4&&r()<.83)scree.push([spot.x,spot.y,spot.z,.29+1.67*r()**1.8]);
       }
     }rows.push(row);
   }
   // Frost rounds the crest of the bench. Its contiguous snowpack has a
   // smooth normal across the grid, even over a fractured supporting ledge.
   const normal=(i,j)=>{
     const along=rows[Math.min(i+1,rows.length-1)][j].clone().sub(rows[Math.max(0,i-1)][j]);
     const across=rows[i][Math.min(j+1,rows[i].length-1)].clone().sub(rows[i][Math.max(j-1,0)]);
     return across.cross(along).normalize();
   };
   const smooth=rows.map((row,i)=>row.map((_,j)=>normal(i,j)));
   function snowTri(i,j,k,l,m,n){
     for(const [x,y] of [[i,j],[k,l],[m,n]]){
       const v=rows[x][y],q=smooth[x][y];
       P.push(v.x,v.y,v.z);N.push(q.x,q.y,q.z);age.push(.5);lip.push(2);
     }
   }
   for(let i=1;i<rows.length;i++)for(let j=0;j<rows[i].length-1;j++){
     if(j<6){snowTri(i-1,j,i-1,j+1,i,j);snowTri(i-1,j+1,i,j+1,i,j);continue;}
     const a=rows[i-1][j],b=rows[i][j],c=rows[i-1][j+1],d=rows[i][j+1];
     tri(a,c,b,.5,0);tri(c,d,b,.5,0);
   }
 }
 shelf([[253,223],[261,225],[276,230],[295,235],[323,241],[353,240],[377,250],[399,253],[430,263]],57);
 shelf([[287,265],[302,272],[326,278],[354,282],[377,287],[403,288],[431,300],[455,305]],135,.68);
 shelf([[278,290],[294,297],[307,303],[336,310],[361,314],[384,323],[413,326],[442,336]],92);
 // Narrow, broken snow pockets accent the cross-joints west of the toe.
 shelf([[118,104],[124,107],[135,110],[145,112],[155,116],[165,118],[173,122]],189,.22);
 shelf([[129,135],[136,137],[144,140],[151,141],[155,140]],213,.13);
 const g=new T.BufferGeometry();for(const [n,v,size] of [["position",P,3],["normal",N,3],["age",age,1],["lip",lip,1]])g.setAttribute(n,new T.Float32BufferAttribute(v,size));
 g.computeBoundingSphere();
 const fs=cliffFragment.replace('varying vec3 world,normalW;','varying float ledgeSkin;varying vec3 world,normalW;')
   .replace('vec2 s=vec2(', 'vec3 meshN=normalize(normalW);n=normalize(mix(n,meshN,.89));vec2 s=vec2(')
   .replace('vec3 majorNormal=normalize(mix(substrate,parentFace,.82));','vec3 majorNormal=normalize(mix(meshN,parentFace,.20));')
   .replace('float below=texture2D(',  `float powder=ledgeSkin>1.5?smoothstep(.32,.78,meshN.y+.21*(run-.5)+.87*(fb(world.xz/vec2(4.,2.6))-.5)):0.;
      color=mix(color,vec3(.38,.48,.66)*(.55+.22*ex.r+.25*meshN.y+.12*meshN.x)*(.86+.26*fb(world.xz*vec2(1.9,2.4))),powder);float below=texture2D(`);
 const mat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,
   vertexShader:`attribute float lip;varying float ledgeSkin;varying vec3 world,normalW;varying vec2 mapUV;
   void main(){world=position;normalW=normal;ledgeSkin=lip;mapUV=(position.xy-vec2(-695.,-28.))/vec2(1390.,565.);
    gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,fragmentShader:fs});
 scene.add(new T.Mesh(g,mat));return {plants,scree};
}
