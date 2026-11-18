import * as T from "three";
import {rng,ground,summit,front,crest,noise,westernRange} from "./batholith.js";
import {U} from "./granite.js";
const V=(x,y,z)=>new T.Vector3(x,y,z);
const wood=0,needles=1,powder=2;
function specimen(seed,pine){
  const r=rng(seed),pos=[],normal=[],material=[],light=[];
  const lean=(r()-.5)*(pine?.16:.075),bow=(r()-.5)*.070;
  const stemAt=y=>V(lean*y*y+.008*Math.sin(y*8)*y,y,bow*y*y);
  function vertex(p,n,id,lum){pos.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);material.push(id);light.push(lum);}
  function tri(a,b,c,na,nb,nc,id,lum){vertex(a,na,id,lum);vertex(b,nb,id,lum);vertex(c,nc,id,lum);}
  function rod(a,b,ra,rb,sides){
    const axis=b.clone().sub(a).normalize(),u=axis.clone().cross(Math.abs(axis.y)>.96?V(1,0,0):V(0,1,0)).normalize(),v=axis.clone().cross(u);
    for(let j=0;j<sides;j++){
      const n=u.clone().multiplyScalar(Math.cos(j*6.283/sides)).addScaledVector(v,Math.sin(j*6.283/sides));
      const m=u.clone().multiplyScalar(Math.cos((j+1)*6.283/sides)).addScaledVector(v,Math.sin((j+1)*6.283/sides));
      const a0=a.clone().addScaledVector(n,ra),a1=a.clone().addScaledVector(m,ra),b0=b.clone().addScaledVector(n,rb),b1=b.clone().addScaledVector(m,rb);
      tri(a0,a1,b0,n,m,n,wood,.82+r()*.16);tri(a1,b1,b0,m,m,n,wood,.88);
    }
  }
  // Snow loads the upper needles of a spray and droops down its outer edge.
  function snow(a,b,radius,shade){
    const axis=b.clone().sub(a),width=V(-axis.z,0,axis.x).normalize(),rings=[];
    for(let i=0;i<=4;i++){
      const t=i/4,rad=radius*(.25+.75*Math.sin(Math.PI*t)**.53)*(.79+.29*r());
      const p=a.clone().addScaledVector(axis,t);p.y+=.18*rad;const row=[];
      for(let j=0;j<5;j++){
        const ang=j*Math.PI/4,n=width.clone().multiplyScalar(Math.cos(ang));n.y=Math.sin(ang)*1.27;
        const q=p.clone().addScaledVector(width,rad*Math.cos(ang));q.y+=rad*.67*Math.sin(ang);
        row.push([q,n.normalize()]);
      }rings.push(row);
    }
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const [a,b,c,d]=[rings[i][j],rings[i+1][j],rings[i][j+1],rings[i+1][j+1]];
      tri(a[0],b[0],c[0],a[1],b[1],c[1],powder,shade);tri(c[0],b[0],d[0],c[1],b[1],d[1],powder,shade);
    }
  }
  for(let i=0;i<8;i++)rod(stemAt(i/8),stemAt((i+1)/8),.016*(1-i/8)**.80+.001,.016*(1-(i+1)/8)**.80+.001,8);
  const mountainPine=pine&&seed%3!==1;
  const bottom=pine?.22+r()*.18:.035+r()*.055,tiers=pine?16:25;
  const phase=r()*6.28;
  for(let i=0;i<tiers;i++){
    const h=bottom+(i+.16*r())/tiers*(.983-bottom);
    const limbs=(pine?2:5)+Math.floor(r()*(pine?3:4)),spin=r()*6.28;
    for(let j=0;j<limbs;j++){
      const ang=spin+6.283*j/limbs+.25*(r()-.5),dx=Math.cos(ang),dz=Math.sin(ang);
      const envelope=pine?(.62+.43*Math.sin(Math.PI*(h-.05)))*(1-h)**(mountainPine?.89:.67):(1-h)**.77;
      const len=(pine?.395:.295)*envelope*(.60+.56*r())*(1+(pine?.29:.13)*Math.cos(ang-phase));
      const base=stemAt(h),bend=(pine?.07:.17)+.08*r();
      const at=t=>base.clone().add(V(dx*len*t,len*(-bend*Math.sin(t*Math.PI*1.07)-.13*t+(pine?.28:.15)*t**3),dz*len*t));
      rod(base,at(.57),len*.042,len*.019,4);rod(at(.57),at(1),len*.019,.0007,3);
      const shade=.72+.28*r(),coated=r()>(mountainPine?.86:pine?.63:.040);
      if(coated){
        const from=(pine?.39:.19)+r()*.24,last=.78+r()*.19;
        for(let clump=0;clump<3;clump++){
          const start=from+(last-from)*clump/3,end=from+(last-from)*Math.min(1,(clump+1.18)/3);
          const belly=len*(pine?.068:.147)*(1-.50*start)*(.78+.61*r());
          const a=at(start),b=at(end);a.y+=.55*belly;b.y+=.20*belly;snow(a,b,belly,shade);
        }
      }
      for(let k=pine?3:1;k<=8;k++)for(const sign of [-1,1]){
        const t=k/9,a=at(t),length=len*(pine?.46-.16*t:.35-.20*t)*(.70+.46*r());
        const side=V(dx*.56-dz*.83*sign,pine?.12-.36*r():-.20-.29*r(),dz*.56+dx*.83*sign);
        const b=a.clone().addScaledVector(side,length);
        // The woody spray carries overlapping fans of fine needles. The shaded
        // underside stays visible beneath deposited snow even at valley scale.
        const orth=V(-side.z,0,side.x).normalize(),hood=V(0,1,0);
        const mid=a.clone().lerp(b,.42).addScaledVector(hood,length*.033);
        const breadth=length*(pine?.105:.29)*(.8+.27*r());
        const lo=mid.clone().addScaledVector(orth,breadth),hi=mid.clone().addScaledVector(orth,-breadth);
        tri(a,lo,b,hood,hood,hood,needles,shade*.79);tri(a,b,hi,hood,hood,hood,needles,shade*.86);
        const radial=V(dx,0,dz),tangent=V(-side.z,0,side.x).normalize();
        for(let m=0;m<7;m++){
          const f=m/7,o=a.clone().lerp(b,f),tuft=length*(.37-.17*f)*(.76+.41*r());
          for(const n of [-1,1]){
            const tip=o.clone().addScaledVector(side,tuft*.42).addScaledVector(tangent,tuft*n*.82);
            tip.y+=tuft*(pine?.22+.55*r():-.63-.4*r());const left=o.clone().addScaledVector(side,tuft*.66);
            const nn=radial.clone().multiplyScalar(.44).addScaledVector(tangent,n*.56);nn.y=pine?.72:.4;
            tri(o,tip,left,nn,nn,nn,needles,shade*(.73+.33*f));
          }
        }
        if(coated&&r()>.23&&k<8)snow(a.clone().lerp(b,.13),a.clone().lerp(b,.86),length*(.21+.22*r()),shade*(.93+.10*r()));
      }
    }
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("normal",new T.Float32BufferAttribute(normal,3));
  g.setAttribute("part",new T.Float32BufferAttribute(material,1));g.setAttribute("exposed",new T.Float32BufferAttribute(light,1));g.computeBoundingSphere();return g;
}
const vertex=`attribute float part,exposed;varying float species,openSky,h;varying vec3 n,p;
void main(){species=part;openSky=exposed;h=position.y;p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;
const frag=`varying float species,openSky,h;varying vec3 n,p;uniform float day,amber;uniform float atlas;
void main(){
  vec3 N=normalize(n);float sky=.53+.25*max(0.,N.y)+.36*max(0.,dot(N,normalize(vec3(-.75,.56,.36))));
  float occlusion=openSky*(.81+.19*sqrt(clamp(h,0.,1.)));
  vec3 c=species>1.5?vec3(.64,.735,.87):species>.5?vec3(.078,.127,.105):vec3(.181,.145,.111);
  c*=sky*occlusion*(.90+.16*day);
  float rim=(1.-day)*max(0.,N.x*-.75+N.y*.25)*smoothstep(.61,1.,h);
  c+=vec3(.149,.075,.024)*rim*openSky;
  if(atlas<.5){c*=vec3(.82,.95,1.17);float distance=length(cameraPosition-p);c=mix(c,vec3(.16,.22,.30),1.-exp(-distance*.00010));}
  gl_FragColor=vec4(c,1.);
}`;
export async function growForest(renderer,scene,uniforms,course,ledgePlants=[]){
  const atlas=new T.WebGLRenderTarget(2048,1536,{depthBuffer:true,minFilter:T.LinearMipmapLinearFilter,generateMipmaps:true});
  const arboretum=new T.Scene(),cam=new T.OrthographicCamera(-.43,.43,1.05,-.02,.01,10);
  const mat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:frag,uniforms:{...uniforms,atlas:U(1)},side:T.DoubleSide});
  const retained=[],oldClear=new T.Color();renderer.getClearColor(oldClear);const oldAlpha=renderer.getClearAlpha();
  renderer.setRenderTarget(atlas);renderer.setClearColor(0,0);renderer.clear();
  renderer.autoClear=false;renderer.setScissorTest(true);
  for(let i=0;i<8;i++){
    const pine=i>3,g=specimen(6191+i*4303,pine),tree=new T.Mesh(g,mat);arboretum.add(tree);
    renderer.setViewport(i%4*512,Math.floor(i/4)*768,512,768);renderer.setScissor(i%4*512,Math.floor(i/4)*768,512,768);
    cam.position.set(0,.035,3);cam.lookAt(0,0,0);cam.updateMatrixWorld();renderer.render(arboretum,cam);arboretum.remove(tree);
    if(i===1||i===4||i===6)retained.push(g);else g.dispose();
    await new Promise(r=>setTimeout(r,2));
  }
  renderer.setScissorTest(false);renderer.autoClear=true;renderer.setRenderTarget(null);renderer.setClearColor(oldClear,oldAlpha);
  const r=rng(653215),roots=[],props=[];
  const plant=(x,y,z,h,pine,variation=1)=>{
    roots.push(x,y-h*.014,z,h);props.push((pine?4:0)+Math.floor(r()*4),.78+.28*r(),variation*(.80+.32*r()));
  };
  for(let i=0;i<27000;i++){
    const x=(r()-.5)*1430,z=24+r()*943,y=ground(x,z);
    if(y<3.9||Math.hypot(x-course.hit.x,z-course.hit.z)<47)continue;
    const mask=.62+.54*noise(x/49+47,z/63)+.32*noise(x/17,z/29);
    if(r()>mask||z<49&&y>110)continue;
    if(x< -228&&z>126&&y>94){
      const gradient=Math.hypot(ground(x+2,z)-ground(x-2,z),ground(x,z+2)-ground(x,z-2))/4;
      const exposure=Math.max(0,Math.min(1,(gradient-.33)*1.6));
      if(r()<.79*exposure)continue;
    }
    if(z>592&&Math.abs(x+18)<82&&z<771)continue;
    const bareSlope=Math.exp(-(((x-course.hit.x)/91)**2+((z-course.hit.z-15)/62)**2));
    if(r()<bareSlope*.83)continue;
    const mature=1.+.40*Math.max(0,noise(x/69,z/57+34));
    const height=(5.4+28*r()**.82)*(.69+.30*mask)*(1-.69*bareSlope)*mature;
    plant(x,y,z,height,r()<.24);
  }
  for(let i=0;i<1430;i++){
    const x=(r()-.5)*1250,d=3+r()**1.5*155;if(Math.abs(x-242)<12&&d<28)continue;
    if(r()>.59+.39*noise(x/33,d/28))continue;
    plant(x,summit(x,d),front(x,crest(x))-d,2.5+13.2*r()**1.37,true);
  }
  const outerTrees=rng(121548);
  for(let i=0;i<3300;i++){
    const x=-1160+outerTrees()*788,z=-315+outerTrees()*383;
    const nearCrown=westernRange(x,z);
    const density=.31+.35*noise(x/45,z/39,true);
    if(outerTrees()>density)continue;
    plant(x,nearCrown-.09,z,2.35+8.6*outerTrees()**1.3,outerTrees()>.32,.84);
  }
  for(const [x,z,h] of [[-66,721,38],[-61,729,31],[-72,716,39],[22,722,36],[29,717,41],[26,733,29]])plant(x,ground(x,z),z,h,false,1.05);
  for(const [x,y,z,h] of ledgePlants)plant(x,y,z,h,r()>.47,.75+r()*.53);
  const quad=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();g.index=quad.index;g.setAttribute("position",quad.attributes.position);g.setAttribute("uv",quad.attributes.uv);
  g.setAttribute("root",new T.InstancedBufferAttribute(new Float32Array(roots),4));g.setAttribute("arbor",new T.InstancedBufferAttribute(new Float32Array(props),3));g.instanceCount=roots.length/4;
  const canopy=new T.ShaderMaterial({uniforms:{...uniforms,treeAtlas:U(atlas.texture)},side:T.DoubleSide,
    vertexShader:`attribute vec4 root;attribute vec3 arbor;uniform float clockTime,shadowsOn;
    uniform sampler2D farSky,sunDepth;uniform mat4 farSkyVP,sunVP;
    varying vec2 leaf;varying float shade,dist,lightAccess,edgeLight,crown;
    float lit(sampler2D field,mat4 vp,vec3 p,float bias){
      vec4 q=vp*vec4(p,1.);vec3 uv=q.xyz/q.w*.5+.5;
      if(min(uv.x,uv.y)<.002||max(uv.x,uv.y)>.998)return 1.;
      return 1.-smoothstep(bias,bias*2.4,uv.z-textureLod(field,uv.xy,0.).r);
    }
    void main(){vec2 direction=normalize(vec2(viewMatrix[0][0],viewMatrix[2][0]));vec3 p=root.xyz;
    p.xz+=direction*(uv.x-.5)*root.w*.86/1.07*arbor.z;p.y+=(uv.y*1.07-.02)*root.w;
    p.x+=uv.y*uv.y*.004*root.w*sin(clockTime*.69+root.z*.068+root.x*.026);
    leaf=(vec2(mod(arbor.x,4.),floor(arbor.x/4.))+clamp(uv,.001,.999))/vec2(4.,2.);shade=arbor.y;dist=length(cameraPosition-p);crown=uv.y;
    vec3 exposurePoint=mix(root.xyz+vec3(0.,root.w*.36,0.),p,uv.y);
    lightAccess=1.;edgeLight=0.;
    if(shadowsOn>.5){
      lightAccess=.72+.28*lit(farSky,farSkyVP,exposurePoint+vec3(0.,.6,0.),.00038);
      if(root.y>360.)edgeLight=lit(sunDepth,sunVP,p+vec3(-.4,.45,0.),.00024)*(1.-.68*uv.x)*smoothstep(.30,1.,uv.y);
    }
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform sampler2D treeAtlas;uniform float day,amber;varying vec2 leaf;varying float shade,dist,lightAccess,edgeLight,crown;
    void main(){vec4 t=texture2D(treeAtlas,leaf);if(t.a<.24)discard;
    vec3 c=t.rgb/max(.49,t.a)*shade*(.98+.22*day);c*=vec3(.84,.96,1.17)*lightAccess*(.78+.22*smoothstep(.08,.84,crown));c+=vec3(.113,.058,.019)*edgeLight*amber;c=mix(c,vec3(.115,.181,.285),1.-exp(-dist*.000205));gl_FragColor=vec4(c,1.);}`});
  const mesh=new T.Mesh(g,canopy);mesh.frustumCulled=false;scene.add(mesh);
  const liveMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:frag,uniforms:{...uniforms,atlas:U(0)},side:T.DoubleSide});
  const hero=(i,x,y,z,h,angle=0)=>{
    const m=new T.Mesh(retained[i],liveMat);m.scale.setScalar(h);m.position.set(x,y,z);m.rotation.y=angle;scene.add(m);return m;
  };
  // The solitary pine on the detached left-hand buttress is visible in the wide view.
  const shelfX=-285,shelfY=195;let nose=front(shelfX,shelfY);
  for(let y=shelfY;y<shelfY+42;y+=2)nose=Math.max(nose,front(shelfX,y));
  const oldPine=hero(1,shelfX,shelfY,nose+.7,38,.55);oldPine.scale.x*=1.25;oldPine.scale.z*=1.25;
  for(const [x,d,h] of [[126,19,14],[156,26,15],[178,24,13],[218,23,11],[258,9,12],[272,36,15],[304,22,13]]){
    hero(2,x,summit(x,d)-.35,front(x,crest(x))-d,h,r()*6.28);
  }
  return {hero,atlas,retained};
}
