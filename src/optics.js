import * as T from "three";

// A small lens glow is extracted from the rendered light on the water.
// All passes share a fullscreen triangle and use byte targets on the integrated GPU.
export class Lens {
  constructor(renderer){
    this.renderer=renderer;
    this.frame=new T.WebGLRenderTarget(2,2,{depthBuffer:true,stencilBuffer:false});
    this.frame.depthTexture=new T.DepthTexture(2,2,T.UnsignedIntType);
    this.ambient=new T.WebGLRenderTarget(2,2,{depthBuffer:false});
    this.low=new T.WebGLRenderTarget(2,2,{depthBuffer:false});
    this.blur=new T.WebGLRenderTarget(2,2,{depthBuffer:false});
    this.camera=new T.Camera();this.scene=new T.Scene();
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const vertexShader="varying vec2 st;void main(){st=position.xy*.5+.5;gl_Position=vec4(position,1.);}";
    const uniforms=this.u={source:{value:null},blurred:{value:null},second:{value:null},pixel:{value:new T.Vector2()},delta:{value:new T.Vector2()},time:{value:0},sun:{value:0},dusk:{value:0},
      depthMap:{value:this.frame.depthTexture},ambientMap:{value:this.ambient.texture},inverseLens:{value:new T.Matrix4()},focal:{value:new T.Vector2()}};
    const material=fragmentShader=>new T.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false});
    this.extract=material(`varying vec2 st;uniform sampler2D source;uniform vec2 delta;
      vec3 hot(vec2 uv){vec3 c=texture2D(source,uv).rgb;return c*smoothstep(.11,.66,c.r-c.b)*smoothstep(.32,.82,c.r);}
      void main(){gl_FragColor=vec4((hot(st-delta)+hot(st+delta)+hot(st+vec2(delta.x,-delta.y))+hot(st+vec2(-delta.x,delta.y)))*.25,1.);}`);
    this.diffuse=material(`varying vec2 st;uniform sampler2D source;uniform vec2 delta;
      void main(){vec3 c=.227027*texture2D(source,st).rgb;
      c+=.316216*(texture2D(source,st+1.384615*delta).rgb+texture2D(source,st-1.384615*delta).rgb);
      c+=.07027*(texture2D(source,st+3.230769*delta).rgb+texture2D(source,st-3.230769*delta).rgb);
      gl_FragColor=vec4(c,1.);}`);
    this.occlude=material(`varying vec2 st;uniform sampler2D depthMap;uniform mat4 inverseLens;uniform vec2 focal;
      vec3 point(vec2 uv){
        float depth=textureLod(depthMap,clamp(uv,.0001,.9999),0.).r;
        vec4 p=inverseLens*vec4(uv*2.-1.,depth*2.-1.,1.);
        return p.xyz/p.w;
      }
      void main(){
        vec3 p=point(st);
        vec3 n=normalize(cross(dFdx(p),dFdy(p)));
        if(p.z< -3000.){gl_FragColor=vec4(1.);return;}
        float radius=clamp(-p.z*.019,1.4,11.),sum=0.;
        for(int i=0;i<12;i++){
          float stepNo=float(i),angle=stepNo*2.399963,r=(stepNo+.9)/12.;
          vec2 uv=st+vec2(cos(angle),sin(angle))*sqrt(r)*focal*radius/max(1.,-p.z);
          vec3 d=point(uv)-p;float len=length(d);
          sum+=max(0.,dot(n,d)/max(.01,len)-.082)*(1.-smoothstep(radius*.23,radius*1.36,len));
        }
        gl_FragColor=vec4(vec3(clamp(1.-sum*.127,.61,1.)),1.);}`);
    this.average=material(`varying vec2 st;uniform sampler2D source,second;
      void main(){vec3 a=texture2D(source,st).rgb,b=texture2D(second,st).rgb;gl_FragColor=vec4(sqrt(.5*(a*a+b*b)),1.);}`);
    this.grade=material(`varying vec2 st;uniform sampler2D source,blurred,ambientMap,depthMap;uniform float time,sun,dusk;uniform vec2 pixel;
      float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
      void main(){
        vec3 c=texture2D(source,st).rgb,halation=texture2D(blurred,st).rgb;
        vec2 h=vec2(pixel.x,0.),v=vec2(0.,pixel.y);
        vec3 a=texture2D(source,st-h).rgb,b=texture2D(source,st+h).rgb,d=texture2D(source,st-v).rgb,e=texture2D(source,st+v).rgb;
        float ya=luma(a),yb=luma(b),yd=luma(d),ye=luma(e),yc=luma(c);
        float range=max(max(ya,yb),max(yd,ye))-min(min(ya,yb),min(yd,ye));
        vec2 tangent=vec2(yd-ye,yb-ya);tangent/=max(.0001,max(abs(tangent.x),abs(tangent.y)));
        vec3 aa=.5*(texture2D(source,st-.49*pixel*tangent).rgb+texture2D(source,st+.49*pixel*tangent).rgb);
        float close=1.-smoothstep(.972,.992,texture2D(depthMap,st).r);
        c=mix(c,aa,.60*smoothstep(.065,.21,range));c=mix(c,(a+b+d+e)*.25,close*.29);
        c*=mix(texture2D(ambientMap,st).r,1.,smoothstep(.08,.52,c.r-c.b));
        c+=halation*vec3(.225,.167,.128)*(.40+.60*sun);
        c*=mix(vec3(1.),vec3(.72,.77,.85),dusk);float y=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(y),c,1.035);
        c=mix(c,c*c*(3.-2.*c),.095);
        vec2 ap=(st-.5)*vec2(1.0,.83);
        c*=1.-.092*dot(ap,ap);
        float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy+floor(time*24.)*.811,vec2(.06711056,.00583715))))-.5;
        c+=noise*.0082*(.55+.45*smoothstep(.015,.19,y));
        gl_FragColor=vec4(c,1.);}`);
    this.triangle=new T.Mesh(g,this.grade);this.triangle.frustumCulled=false;this.scene.add(this.triangle);
  }
  resize(w,h){
    this.u.pixel.value.set(1/w,1/h);this.frame.setSize(w,h);const a=Math.max(2,Math.ceil(w/5)),b=Math.max(2,Math.ceil(h/5));
    this.ambient.setSize(Math.max(2,Math.ceil(w*.5)),Math.max(2,Math.ceil(h*.5)));
    this.low.setSize(a,b);this.blur.setSize(a,b);
  }
  pass(mat,input,output){
    this.u.source.value=input.texture;this.renderer.setRenderTarget(output);
    this.triangle.material=mat;this.renderer.render(this.scene,this.camera);
  }
  finish(t,sun,cam,color=this.frame,destination=null){
    this.u.inverseLens.value.copy(cam.projectionMatrixInverse);
    this.u.focal.value.set(cam.projectionMatrix.elements[0]*.5,cam.projectionMatrix.elements[5]*.5);
    this.pass(this.occlude,this.frame,this.ambient);
    this.u.delta.value.set(.95/this.frame.width,.95/this.frame.height);
    this.pass(this.extract,color,this.low);
    this.u.delta.value.set(1.75/this.low.width,0);this.pass(this.diffuse,this.low,this.blur);
    this.u.delta.value.set(0,1.75/this.low.height);this.pass(this.diffuse,this.blur,this.low);
    this.u.blurred.value=this.low.texture;this.u.time.value=t;this.u.sun.value=sun;
    this.pass(this.grade,color,destination);
  }
}
