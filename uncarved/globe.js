(function(){
"use strict";
const {DATA,PUNCT,TONES,VOWELS,GLOSS,KEY,ANCHORS,WIT,WNOTE,WED}=window.DDJ;
const CH=DATA.ch,EN=DATA.en,NCH=CH.length;
const emit=(n,d)=>window.dispatchEvent(new CustomEvent("globe:"+n,{detail:d||{}}));
const HAN=/[㐀-鿿\u{20000}-\u{2ffff}]/u;
const reduce=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t;
const soft=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const ease=t=>{t=clamp(t,0,1);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const outCubic=t=>{t=clamp(t,0,1);return 1-Math.pow(1-t,3);};
const inQuad=t=>{t=clamp(t,0,1);return t*t;};
const TAU=Math.PI*2;
const hash=n=>{n=Math.imul((n|0)^0x9e3779b9,0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);return (n^n>>>16)>>>0;};
const D10="〇一二三四五六七八九";
const cn=n=>n<10?D10[n]:n<20?"十"+(n%10?D10[n%10]:""):D10[Math.floor(n/10)]+"十"+(n%10?D10[n%10]:"");

// ---------- the text ----------
const glyphs=[],gChap=[],chStart=[],chEnd=[];
CH.forEach(([t,txt],k)=>{chStart[k]=glyphs.length;for(const c of txt)if(HAN.test(c)){glyphs.push(c);gChap.push(k);}chEnd[k]=glyphs.length-1;});
const N=glyphs.length;
const OPENERS="「『（(“";
const before=new Array(N).fill(""),after=new Array(N).fill("");
CH.forEach(([t,txt],k)=>{let gi=chStart[k],pend="";for(const c of txt){if(HAN.test(c)){before[gi]=pend;pend="";gi++;}else if(c.trim()){if(OPENERS.includes(c))pend+=c;else if(gi>chStart[k])after[gi-1]+=c;}}});
// passages: each English stanza of the translation, paired by hand with the Chinese it translates
const STANZAS=CH.map((_,k)=>{
  const st=EN[k].split("\n\n").map(s=>s.split("\n"));
  const a0=chStart[k],n=chEnd[k]-a0+1,g=glyphs.slice(a0,chEnd[k]+1).join("");
  const an=ANCHORS[k+1]||[],cuts=[0];
  for(const a of an){const i=g.indexOf(a,cuts[cuts.length-1]+1);cuts.push(i>0?i:Math.min(n-1,cuts[cuts.length-1]+1));}
  cuts.push(n);
  return st.map((lines,s)=>({a:a0+cuts[s],b:a0+Math.max(cuts[s],cuts[s+1]-1),lines}));
});
const stOf=new Int16Array(N);STANZAS.forEach(arr=>arr.forEach((z,s)=>{for(let i=z.a;i<=z.b;i++)stOf[i]=s;}));
const COUNT=new Map();for(const c of glyphs)COUNT.set(c,(COUNT.get(c)||0)+1);
// how each character sounds: its tone as a pitch shape, a phrase falling like speech and lifting after each comma
const TONE=new Int8Array(N),NA=new Int8Array(N),NB=new Int8Array(N);
for(let i=0;i<N;i++)TONE[i]=+TONES[i]||5;
const VOW=VOWELS.split("");for(let i=0;i<N;i++)if(glyphs[i]==="還")VOW[i]="A";
STANZAS.forEach(arr=>arr.forEach(z=>{let rb=6+hash(z.a)%3;for(let gi=z.a;gi<=z.b;gi++){const t=TONE[gi],pc=+PUNCT[gi];let x=Math.round(rb),y=x;
  if(t===1){x=y=x+2;}else if(t===2){y=x+2;}else if(t===3){x=y=x-1;}else if(t===4){y=x;x=x+3;}
  NA[gi]=clamp(x,0,19);NB[gi]=clamp(y,0,19);rb=Math.max(3,rb-0.15);if(pc)rb=6+hash(gi*7+1)%3-(pc===3?1:0);}}));

// ---------- the globe: one spiral of the whole book, chapter 1 at the north pole ----------
const LEAD=16,GAP=2,TAIL=16,SL=LEAD+N+GAP*(NCH-1)+TAIL;
const slotOf=new Int32Array(N),glyphAt=new Int32Array(SL).fill(-1);
{let s=LEAD;for(let k=0;k<NCH;k++){for(let i=chStart[k];i<=chEnd[k];i++){slotOf[i]=s;glyphAt[s]=i;s++;}s+=GAP;}}
const STEP=3.6/Math.sqrt(SL);
const SPHI=new Float64Array(SL),SLAT=new Float64Array(SL),P=new Float32Array(N*3);
{let phi=0;for(let k=0;k<SL;k++){const h=1-2*(k+.5)/SL,r=Math.sqrt(1-h*h);if(k>0)phi+=STEP/r;SPHI[k]=phi;SLAT[k]=Math.asin(h);const gi=glyphAt[k];if(gi>=0){P[gi*3]=r*Math.sin(phi);P[gi*3+1]=h;P[gi*3+2]=r*Math.cos(phi);}}}
const PHI_MAX=SPHI[SL-1],TURNS=PHI_MAX/TAU,ROWGAP=Math.PI/TURNS;
const SIZE=STEP*0.86,THICK=SIZE*0.17,K=6,SIG=STEP*0.55;
const PMAX=1.47;
const phiAt=s=>{s=clamp(s,0,SL-1);const i=Math.min(SL-2,Math.floor(s));return lerp(SPHI[i],SPHI[i+1],s-i);};
const latAt=s=>{s=clamp(s,0,SL-1);const i=Math.min(SL-2,Math.floor(s));return lerp(SLAT[i],SLAT[i+1],s-i);};
function slotForPhi(phi){let lo=0,hi=SL-1;if(phi<=SPHI[0])return 0;if(phi>=SPHI[hi])return hi;while(hi-lo>1){const m=(lo+hi)>>1;if(SPHI[m]<=phi)lo=m;else hi=m;}return lo+(phi-SPHI[lo])/(SPHI[hi]-SPHI[lo]);}
// the place in the text under the reading lens: the groove whose longitude faces you, nearest your latitude, keeping to the groove it was in
function headFrom(yaw,pitch,prev){
  const lam=-yaw,m0=Math.ceil((SPHI[0]-lam)/TAU),m1=Math.floor((PHI_MAX-lam)/TAU);
  let best=prev,bc=1e9,cont=-1,cd=1e9;
  for(let m=m0;m<=m1;m++){const s=slotForPhi(lam+TAU*m),c=Math.abs(latAt(s)-pitch);if(c<bc){bc=c;best=s;}const d=Math.abs(s-prev);if(d<cd){cd=d;cont=s;}}
  if(cont>=0&&Math.abs(latAt(cont)-pitch)<bc+ROWGAP*0.8)return cont;
  return best;
}
function nearestGlyph(s,dir){
  let k=clamp(Math.round(s),0,SL-1);if(glyphAt[k]>=0)return k;
  for(let d=1;d<SL;d++){const a=k+(dir||1)*d,b=k-(dir||1)*d;if(a>=0&&a<SL&&glyphAt[a]>=0)return a;if(b>=0&&b<SL&&glyphAt[b]>=0)return b;}
  return slotOf[0];
}

// ---------- WebGL ----------
const canvas=$("gl"),ov=$("ov"),ox=ov.getContext("2d");
const gl=canvas.getContext("webgl2",{antialias:true,alpha:false,powerPreference:"high-performance"});
if(!gl){$("fallback").style.display="grid";return;}
const GVS=`#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aPos;
layout(location=2) in vec2 aCell;
layout(location=3) in vec3 aMeta;
layout(location=4) in float aPress;
uniform mat3 uRot;uniform mat4 uProj;
uniform float uDist,uSize,uThick,uK,uT,uIntro,uN,uLens,uMag,uSig,uTouchAmt,uHiAmt,uFocus,uFocusAmt,uChapA,uChapAAmt,uChapB,uChapBAmt,uHoleA,uHoleB,uDim,uGrid;
uniform vec3 uNeedle,uTouch,uLight,uBone,uRed,uGold,uBronze,uSide;
uniform vec2 uHiCell;
uniform vec4 uRip[4];uniform vec4 uGat;uniform float uGatS;
out vec2 vUV;flat out vec3 vCol;
void main(){
  float layer=aMeta.x,ch=aMeta.y,idx=aMeta.z;
  vec3 n=aPos;
  float lift=0.0,glow=0.0;
  if(uGatS>0.001){
    float dg=acos(clamp(dot(n,uGat.xyz),-1.0,1.0));
    if(dg<0.5){
      float t=1.0-dg/0.5;t=t*t*(3.0-2.0*t);
      float th=uGatS*t*(0.8+1.6*t)*(uT-uGat.w)*1.7;
      vec3 ax=uGat.xyz;float co=cos(th),si=sin(th);
      n=n*co+cross(ax,n)*si+ax*dot(ax,n)*(1.0-co);
      n=normalize(mix(n,ax,uGatS*t*0.28));
      lift+=uGatS*t*(0.07+0.035*sin(uT*3.1+idx*1.7));
      glow+=uGatS*t*0.7;
    }
  }
  for(int i=0;i<4;i++){vec4 rp=uRip[i];float age=uT-rp.w;if(age>0.0&&age<2.4){float dr=acos(clamp(dot(n,rp.xyz),-1.0,1.0));float fr=age*0.95;float am=exp(-age*1.7)*exp(-(dr-fr)*(dr-fr)/0.009);lift+=am*0.045;glow+=am*0.9;}}
  vec3 nw0=uRot*n;
  if((idx>uHoleA-0.5&&idx<uHoleB+0.5)||nw0.z<-0.3){gl_Position=vec4(0.0,0.0,2.0,1.0);vUV=vec2(0.0);vCol=vec3(0.0);return;}
  float p=0.0;
  if(aPress>0.0)p=smoothstep(aPress,aPress+0.3,uT);else if(aPress<0.0)p=1.0-smoothstep(-aPress,-aPress+0.9,uT);
  // the character in the middle of the globe glows a little: that is the one being sounded
  float d=acos(clamp(dot(n,uNeedle),-1.0,1.0));
  float lens=uLens*exp(-d*d/(2.0*uSig*uSig));
  float foc=abs(idx-uFocus)<0.5?uFocusAmt:0.0;
  float s0=idx/uN*0.7;float g=smoothstep(s0,s0+0.3,uIntro);
  float h=uThick*mix(1.0,0.12,p)*g;
  float base=0.0035*(1.0-p)+0.0012*p+foc*0.14;
  float sc=uSize*(1.0+1.5*foc)*mix(0.15,1.0,g);
  float fl=layer/(uK-1.0);
  float r=1.0+base+h*(1.0-fl)+lift;
  if(p>0.5&&layer>0.5)r-=0.03;
  vec3 ex=cross(vec3(0.0,1.0,0.0),n);float el=length(ex);ex=el<1e-4?vec3(1.0,0.0,0.0):ex/el;
  vec3 uy=cross(n,ex);
  vec3 w=uRot*(n*r+(ex*aCorner.x+uy*aCorner.y)*sc);
  gl_Position=uProj*vec4(w.x,w.y,w.z-uDist,1.0);
  vUV=(aCell+vec2(aCorner.x+0.5,0.5-aCorner.y))/uGrid;
  vec3 nw=uRot*n;
  float diff=max(dot(nw,uLight),0.0);
  float shade=(0.24+0.76*diff)*mix(0.3,1.0,smoothstep(-0.3,0.6,nw.z));
  float chm=max(abs(ch-uChapA)<0.5?uChapAAmt:0.0,abs(ch-uChapB)<0.5?uChapBAmt:0.0);
  vec3 top=mix(uBone,uRed,chm*0.88);
  top=mix(top,uBronze,p*(1.0-0.55*chm));
  float hi=(abs(aCell.x-uHiCell.x)<0.5&&abs(aCell.y-uHiCell.y)<0.5)?uHiAmt:0.0;
  top=mix(top,uGold,max(max(hi,foc),min(1.0,glow)));
  vec3 side=mix(uSide,top*0.45,0.3)*(1.0-0.55*fl);
  vec3 c=(layer<0.5?top:side)*shade*(1.0+0.55*lens);
  vCol=c*max(uDim,max(foc,hi*0.85));
}`;
const GFS=`#version 300 es
precision highp float;
in vec2 vUV;flat in vec3 vCol;
uniform sampler2D uAtlas;uniform float uAt;
out vec4 o;
void main(){
  float a=texture(uAtlas,vUV).r;
  vec2 px=fwidth(vUV)*uAt;float lod=log2(max(max(px.x,px.y),1.0));
  float thr=clamp(0.5-0.11*lod,0.16,0.5);
  float cov=clamp((a-thr)/max(fwidth(a),1e-3)+0.5,0.0,1.0);
  if(cov<=0.0)discard;
  o=vec4(vCol,cov);
}`;
const BVS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
uniform mat3 uRot;uniform mat4 uProj;uniform float uDist;
out vec3 vN;
void main(){vec3 w=uRot*(aP*0.998);vN=w;gl_Position=uProj*vec4(w.x,w.y,w.z-uDist,1.0);}`;
const BFS=`#version 300 es
precision highp float;
in vec3 vN;uniform vec3 uLight,uStone,uBone,uBg;uniform float uDim,uA;
out vec4 o;
void main(){
  vec3 n=normalize(vN);float diff=max(dot(n,uLight),0.0);
  vec3 h=normalize(uLight+vec3(0.0,0.0,1.0));float sp=pow(max(dot(n,h),0.0),40.0);
  float rim=pow(1.0-max(n.z,0.0),2.6);
  vec3 c=uStone*(0.4+0.95*diff)+vec3(0.95,0.9,0.8)*sp*0.055+uBone*rim*0.06;
  c*=0.45+0.55*uDim;
  o=vec4(mix(uBg,c,uA),1.0);
}`;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs,names){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const U={};for(const n of names)U[n]=gl.getUniformLocation(p,n);return{p,U};}
const G=program(GVS,GFS,["uRot","uProj","uDist","uSize","uThick","uK","uT","uIntro","uN","uLens","uMag","uSig","uTouchAmt","uHiAmt","uFocus","uFocusAmt","uChapA","uChapAAmt","uChapB","uChapBAmt","uHoleA","uHoleB","uDim","uGrid","uNeedle","uTouch","uLight","uBone","uRed","uGold","uBronze","uSide","uHiCell","uAtlas","uAt","uRip","uGat","uGatS"]);
const B=program(BVS,BFS,["uRot","uProj","uDist","uLight","uStone","uBone","uBg","uDim","uA"]);
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const C={bg:hex("#0b0d12"),bone:hex("#ece2cc"),red:hex("#d9482b"),gold:hex("#f2c46b"),bronze:hex("#7a5f3a"),side:hex("#4a3c2c"),stone:hex("#1c1a16")};
const LIGHT=(()=>{const v=[-0.42,0.55,0.72],l=Math.hypot(...v);return v.map(x=>x/l);})();

// glyph instances: every character as K stacked layers, so it stands up off the globe
const uniq=[...new Set(glyphs)],uIndex=new Map(uniq.map((c,i)=>[c,i]));
const GRID=Math.ceil(Math.sqrt(uniq.length)),AT=2560,CELL=Math.floor(AT/GRID);
const INST=N*K;
const gVAO=gl.createVertexArray();gl.bindVertexArray(gVAO);
function attr(data,loc,size,div,usage){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage||gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(loc,div);return b;}
attr(new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),0,2,0);
{const aPos=new Float32Array(INST*3),aCell=new Float32Array(INST*2),aMeta=new Float32Array(INST*3);
  for(let gi=0;gi<N;gi++){const ci=uIndex.get(glyphs[gi]),cx=ci%GRID,cy=Math.floor(ci/GRID);for(let k=0;k<K;k++){const j=gi*K+k;aPos.set(P.subarray(gi*3,gi*3+3),j*3);aCell[j*2]=cx;aCell[j*2+1]=cy;aMeta[j*3]=k;aMeta[j*3+1]=gChap[gi];aMeta[j*3+2]=gi;}}
  attr(aPos,1,3,1);attr(aCell,2,2,1);attr(aMeta,3,3,1);}
const pressArr=new Float32Array(INST),pressBuf=attr(pressArr,4,1,1,gl.DYNAMIC_DRAW);
gl.bindVertexArray(null);
// the stone body
const bVAO=gl.createVertexArray();gl.bindVertexArray(bVAO);
let bCount=0;
{const SEG=128,RING=64,v=[],ix=[];for(let j=0;j<=RING;j++){const th=Math.PI*j/RING;for(let i=0;i<=SEG;i++){const ph=TAU*i/SEG;v.push(Math.sin(th)*Math.sin(ph),Math.cos(th),Math.sin(th)*Math.cos(ph));}}
  for(let j=0;j<RING;j++)for(let i=0;i<SEG;i++){const a=j*(SEG+1)+i,b=a+SEG+1;ix.push(a,b,a+1,a+1,b,b+1);}
  attr(new Float32Array(v),0,3,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ix),gl.STATIC_DRAW);bCount=ix.length;}
gl.bindVertexArray(null);
gl.useProgram(G.p);
gl.uniform1f(G.U.uSize,SIZE);gl.uniform1f(G.U.uThick,THICK);gl.uniform1f(G.U.uK,K);gl.uniform1f(G.U.uN,N);gl.uniform1f(G.U.uSig,SIG);
gl.uniform1f(G.U.uGrid,GRID);gl.uniform1f(G.U.uAt,AT);gl.uniform1i(G.U.uAtlas,0);
gl.uniform3fv(G.U.uLight,LIGHT);gl.uniform3fv(G.U.uBone,C.bone);gl.uniform3fv(G.U.uRed,C.red);gl.uniform3fv(G.U.uGold,C.gold);gl.uniform3fv(G.U.uBronze,C.bronze);gl.uniform3fv(G.U.uSide,C.side);
gl.useProgram(B.p);
gl.uniform3fv(B.U.uLight,LIGHT);gl.uniform3fv(B.U.uStone,C.stone);gl.uniform3fv(B.U.uBone,C.bone);gl.uniform3fv(B.U.uBg,C.bg);
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
gl.clearColor(C.bg[0],C.bg[1],C.bg[2],1);

const FZH='"DDJ Serif","Noto Serif TC","Songti TC","PMingLiU",serif';
const FEN='"Old Standard TT",Georgia,"Times New Roman",serif';
let atlasReady=false;
function buildAtlas(){
  const cv=document.createElement("canvas");cv.width=cv.height=AT;
  const x=cv.getContext("2d");x.fillStyle="#000";x.fillRect(0,0,AT,AT);
  x.fillStyle="#fff";x.textAlign="center";x.textBaseline="middle";x.font=`700 ${Math.round(CELL*.84)}px ${FZH}`;
  uniq.forEach((c,i)=>x.fillText(c,(i%GRID)*CELL+CELL/2,Math.floor(i/GRID)*CELL+CELL/2));
  const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,gl.RED,gl.UNSIGNED_BYTE,cv);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,4);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const an=gl.getExtension("EXT_texture_filter_anisotropic");if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  cv.width=cv.height=1;atlasReady=true;
}

// ---------- view: a fixed camera; only the globe turns ----------
const VW={W:1,H:1,aspect:1,D:5,q:1,Rpx:100,mag:1.7,M:new Float32Array(9),needle:[0,0,1],charPx:10};
let DPR=1;
const V={yaw:0,pitch:0.4,vy:0,vp:0,pcoast:false,s:LEAD,q:LEAD,detent:null,settled:false,settledAt:0,head:0,chap:0};
function setRot(){const cy=Math.cos(V.yaw),sy=Math.sin(V.yaw),cp=Math.cos(V.pitch),sp=Math.sin(V.pitch),M=VW.M;
  M[0]=cy;M[1]=sp*sy;M[2]=-cp*sy;M[3]=0;M[4]=cp;M[5]=sp;M[6]=sy;M[7]=-sp*cy;M[8]=cp*cy;
  VW.needle[0]=-cp*sy;VW.needle[1]=sp;VW.needle[2]=cp*cy;}
const toWorld=(x,y,z,o)=>{const M=VW.M;o[0]=M[0]*x+M[3]*y+M[6]*z;o[1]=M[1]*x+M[4]*y+M[7]*z;o[2]=M[2]*x+M[5]*y+M[8]*z;return o;};
const toModel=(w,o)=>{const M=VW.M;o[0]=M[0]*w[0]+M[1]*w[1]+M[2]*w[2];o[1]=M[3]*w[0]+M[4]*w[1]+M[5]*w[2];o[2]=M[6]*w[0]+M[7]*w[1]+M[8]*w[2];return o;};
function projW(w,o){const k=VW.q/(VW.D-w[2]);o.x=VW.W/2*(1+w[0]*k/VW.aspect);o.y=VW.H/2*(1-w[1]*k);o.k=k*VW.H/2;return o;}
function hitWorld(x,y){const dx=(2*x/VW.W-1)*VW.aspect/VW.q,dy=(1-2*y/VW.H)/VW.q,dz=-1,oz=VW.D;const a=dx*dx+dy*dy+1,b=2*oz*dz,c=oz*oz-1,disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return[t*dx,t*dy,oz+t*dz];}
// where a character is drawn right now (the same arithmetic as the vertex shader)
const _w=[0,0,0];
function glyphScreen(gi,o){
  const nx=P[gi*3],ny=P[gi*3+1],nz=P[gi*3+2],r=1+0.0035+THICK;
  toWorld(nx*r,ny*r,nz*r,_w);projW(_w,o);o.s=SIZE*o.k;o.f=(VW.M[2]*nx+VW.M[5]*ny+VW.M[8]*nz);
  return o;
}
function persp(f,a,n,fa){const nf=1/(n-fa);return new Float32Array([f/a,0,0,0,0,f,0,0,0,0,(fa+n)*nf,-1,0,0,2*fa*n*nf,0]);}
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,3);
  const W=Math.max(1,canvas.clientWidth),H=Math.max(1,canvas.clientHeight);
  canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ov.width=canvas.width;ov.height=canvas.height;
  VW.W=W;VW.H=H;VW.aspect=W/H;
  VW.Rpx=Math.min(W*0.455,H*0.41,560);
  VW.q=VW.Rpx*Math.sqrt(VW.D*VW.D-1)/(H/2);
  VW.charPx=SIZE*VW.q/(VW.D-1)*H/2*0.84;
  VW.mag=1;
  const pm=persp(VW.q,VW.aspect,0.1,20);
  gl.useProgram(G.p);gl.uniformMatrix4fv(G.U.uProj,false,pm);gl.uniform1f(G.U.uDist,VW.D);gl.uniform1f(G.U.uMag,VW.mag);
  gl.useProgram(B.p);gl.uniformMatrix4fv(B.U.uProj,false,pm);gl.uniform1f(B.U.uDist,VW.D);
  if(R.cur){R.cur.lay=layout(R.cur);}
}

// ---------- sound ----------
// Under the hand the globe is a zither: each character that passes the lens is plucked and bent into its own Mandarin tone.
// Left alone it sings: each character's tone on its own vowel as it rises (the voice of Dao De Jing in 3D), over one low clear tone.
let AUDIO_MUTED=false;const audioMuted=()=>AUDIO_MUTED;
const audio=(()=>{
  let ac=null,out,wetIn,noise,toneG,toneOsc=[],voiceWave=null,curK=-1,voices=[];
  const ks=new Map(),BREATH=5.5/60;
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  const tonicOf=k=>{let off=(k*7)%12;if(off>6)off-=12;return 50+off;};
  const MODES=[[0,2,4,7,9],[0,2,5,7,10],[0,3,5,8,10],[0,2,5,7,9],[0,3,5,7,10]],MODE_OF=[4,1,3,4,0,3,1,2],LAD=[];
  const ladder=k=>LAD[k]||(LAD[k]=(()=>{const t=tonicOf(k),m=MODES[MODE_OF[k%8]],L=[];for(let o=0;o<4;o++)for(const x of m)L.push(t+12*o+x);return L;})());
  const FORM={a:[800,1250],o:[520,880],e:[480,1300],E:[560,1800],i:[300,2250],u:[340,760],v:[300,1900],r:[380,1500]};
  const on=()=>!!ac&&ac.state==="running";
  function init(){
    try{if(navigator.audioSession)navigator.audioSession.type="playback";}catch(e){}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{ac=new AC({latencyHint:"interactive"});}catch(e){try{ac=new AC();}catch(e2){ac=null;return;}}
    const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.connect(ac.destination);
    out=ac.createGain();out.gain.value=0;out.connect(comp);out.gain.setTargetAtTime(audioMuted()?0:1.9,ac.currentTime,0.25);
    const sr=ac.sampleRate,len=Math.floor(sr*4.5),ir=ac.createBuffer(2,len,sr);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const t=i/len;lp+=((Math.random()*2-1)-lp)*(0.5-0.44*t);d[i]=lp*Math.pow(1-t,2.8)*Math.min(1,i/(0.02*sr));}}
    const conv=ac.createConvolver();conv.buffer=ir;wetIn=ac.createGain();wetIn.gain.value=0.75;wetIn.connect(conv);conv.connect(out);
    noise=ac.createBuffer(1,sr*2,sr);{const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
    // one low clear tone, breathing, only while the book reads
    toneG=ac.createGain();toneG.gain.value=0.0001;
    const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1300;lp.Q.value=0.3;
    const br=ac.createGain();br.gain.value=0.75;const lfo=ac.createOscillator();lfo.frequency.value=BREATH;const lg=ac.createGain();lg.gain.value=0.25;lfo.connect(lg);lg.connect(br.gain);lfo.start();
    lp.connect(br);br.connect(toneG);toneG.connect(out);const tw=ac.createGain();tw.gain.value=0.6;toneG.connect(tw);tw.connect(wetIn);
    const f=mtof(tonicOf(0));
    for(const [m,a,d] of [[1,0.5,0],[1,0.5,0.6],[2,0.22,-0.4],[3,0.06,0.3]]){const o=ac.createOscillator();o.frequency.value=f*m+d;const g=ac.createGain();g.gain.value=a;o.connect(g);g.connect(lp);o.start();toneOsc.push([o,m,d]);}
    {const re=new Float32Array(25),im=new Float32Array(25);for(let n=1;n<25;n++)im[n]=1/Math.pow(n,1.15);voiceWave=ac.createPeriodicWave(re,im);}
    curK=0;
    // a silent buffer started inside the touch unlocks older iPhones
    try{const s=ac.createBufferSource();s.buffer=ac.createBuffer(1,1,sr);s.connect(ac.destination);s.start();}catch(e){}
  }
  function chain(pan,wet){
    const g=ac.createGain();let n=g;
    if(ac.createStereoPanner&&pan){const p=ac.createStereoPanner();p.pan.value=clamp(pan,-1,1);g.connect(p);n=p;}
    n.connect(out);if(wet>0){const w=ac.createGain();w.gain.value=wet;n.connect(w);w.connect(wetIn);}
    return g;
  }
  // a plucked string (Karplus-Strong), made once per pitch
  function string(m){
    let b=ks.get(m);if(b)return b;
    const sr=ac.sampleRate,f=mtof(m),len=Math.floor(sr*1.5),d=new Float32Array(len);
    const Pd=sr/f-0.5,Pi=Math.floor(Pd),fr=Pd-Pi,T60=1.4,gg=Math.pow(0.001,1/(f*T60));
    let lp=0;for(let i=0;i<Pi+2&&i<len;i++){lp+=((Math.random()*2-1)-lp)*0.55;d[i]=lp;}
    for(let i=Pi+2;i<len;i++){const a=d[i-Pi]*(1-fr)+d[i-Pi-1]*fr,c=d[i-Pi-1]*(1-fr)+d[i-Pi-2]*fr;d[i]=gg*0.5*(a+c);}
    let x1=0,y1=0,mx=0;for(let i=0;i<len;i++){const y=d[i]-x1+0.995*y1;x1=d[i];y1=y;d[i]=y;if(Math.abs(y)>mx)mx=Math.abs(y);}
    const nrm=mx>0?0.9/mx:1,fade=Math.floor(sr*0.12);for(let i=0;i<len;i++){d[i]*=nrm;if(i>len-fade)d[i]*=(len-i)/fade;}
    b=ac.createBuffer(1,len,sr);b.getChannelData(0).set(d);ks.set(m,b);return b;
  }
  function bend(r,at,tone,ratio){
    r.setValueAtTime(1,at);
    if(tone===2){r.setValueAtTime(1,at+0.05);r.exponentialRampToValueAtTime(ratio,at+0.21);}
    else if(tone===4){r.setValueAtTime(1,at+0.025);r.exponentialRampToValueAtTime(ratio,at+0.15);}
    else if(tone===3){r.setValueAtTime(1,at+0.04);r.exponentialRampToValueAtTime(Math.pow(2,-1.7/12),at+0.17);r.exponentialRampToValueAtTime(1.015,at+0.36);}
  }
  function pluck(gi,vel,at,pan){
    const L=ladder(gChap[gi]),a=L[NA[gi]],b=L[NB[gi]],tone=TONE[gi];
    const src=ac.createBufferSource();src.buffer=string(a-12);
    bend(src.playbackRate,at,tone,Math.pow(2,(b-a)/12));
    const g=ac.createGain(),amp=(tone===5?0.55:1)*(0.085+0.05*vel)*(1-0.4*vel*vel),dur=tone===5?0.3:lerp(1.25,0.4,vel);
    g.gain.setValueAtTime(amp,at);g.gain.setTargetAtTime(0.0001,at+dur*0.35,dur*0.3);
    const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=2400+1600*vel;lp.Q.value=0.4;
    src.connect(lp);lp.connect(g);g.connect(chain(pan||0,0.3));src.start(at);src.stop(at+dur*1.6+0.2);
  }
  function wood(at,f0,f1,dur,gain,nf,ng,pan){
    const o=ac.createOscillator();o.frequency.setValueAtTime(f0,at);o.frequency.exponentialRampToValueAtTime(f1,at+dur*0.6);
    const g=ac.createGain();g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+0.003);g.gain.exponentialRampToValueAtTime(0.0001,at+dur);
    const dst=chain(pan||0,0.22);o.connect(g);g.connect(dst);o.start(at);o.stop(at+dur+0.02);
    if(ng){const s=ac.createBufferSource();s.buffer=noise;const bp=ac.createBiquadFilter();bp.type="bandpass";bp.frequency.value=nf;bp.Q.value=2.5;const h=ac.createGain();
      h.gain.setValueAtTime(ng,at);h.gain.exponentialRampToValueAtTime(0.0001,at+0.025);s.connect(bp);bp.connect(h);h.connect(dst);s.start(at,Math.random()*1.5,0.04);}
  }
  function syllable(at,fa,fb,tone,dur,vow,gain,pan){
    const v=vow.toLowerCase(),nasal=vow!==v,F=FORM[v]||FORM.e,tail=2.0,end=at+dur+tail,nodes=[];
    const env=ac.createGain();
    env.gain.setValueAtTime(0.0001,at);env.gain.exponentialRampToValueAtTime(gain,at+0.045);
    env.gain.exponentialRampToValueAtTime(gain*0.55,at+dur);env.gain.exponentialRampToValueAtTime(0.0001,end);
    const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=nasal?1500:3200;lp.Q.value=0.5;
    const p1=ac.createBiquadFilter();p1.type="peaking";p1.frequency.value=F[0];p1.Q.value=2.2;p1.gain.value=11;
    const p2=ac.createBiquadFilter();p2.type="peaking";p2.frequency.value=F[1];p2.Q.value=3;p2.gain.value=nasal?5:8;
    const colour=ac.createGain();colour.gain.value=0.22;const pure=ac.createGain();pure.gain.value=0.6;
    const vib=ac.createOscillator();vib.frequency.value=5+Math.random()*0.8;
    const vd=ac.createGain();vd.gain.setValueAtTime(0,at);vd.gain.setValueAtTime(0,at+dur*0.85);vd.gain.linearRampToValueAtTime(fb*0.005,at+dur+0.5);vib.connect(vd);
    for(const voiced of [true,false]){
      const o=ac.createOscillator();if(voiced)o.setPeriodicWave(voiceWave);
      const fq=o.frequency;fq.setValueAtTime(fa,at);
      if(tone===3){fq.setValueAtTime(fa,at+dur*0.15);fq.exponentialRampToValueAtTime(fa*0.89,at+dur*0.5);fq.exponentialRampToValueAtTime(fb,at+dur*0.95);}
      else if(fb!==fa){const s0=tone===4?0.08:0.22,e0=tone===4?0.45:0.8;fq.setValueAtTime(fa,at+dur*s0);fq.exponentialRampToValueAtTime(fb,at+dur*e0);}
      vd.connect(fq);o.connect(voiced?colour:pure);o.start(at);o.stop(end+0.1);nodes.push(o);
    }
    colour.connect(lp);lp.connect(p1);p1.connect(p2);p2.connect(env);pure.connect(env);
    env.connect(chain(pan,0.55));vib.start(at);vib.stop(end+0.1);nodes.push(vib);
    return{t:at,nodes,env};
  }
  function bowl(at,f,gain){
    const env=ac.createGain();env.gain.value=1;env.connect(chain(0,0.65));const nodes=[];
    [[1,1,8],[2.76,0.45,5.5],[5.4,0.2,3.2],[8.9,0.08,2]].forEach(([m,a,d],i)=>{for(const s of [-1,1]){
      const o=ac.createOscillator();o.frequency.value=f*m+s*[0.6,1.1,1.9,2.7][i]/2;const g=ac.createGain();
      g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(gain*a,at+0.012);g.gain.exponentialRampToValueAtTime(0.0001,at+d);
      o.connect(g);g.connect(env);o.start(at);o.stop(at+d+0.1);nodes.push(o);}});
    return{t:at,nodes,env};
  }
  function air(at,dur,gain,up){
    const s=ac.createBufferSource();s.buffer=noise;s.loop=true;const lp=ac.createBiquadFilter();lp.type="lowpass";lp.Q.value=0.7;
    lp.frequency.setValueAtTime(up?300:2200,at);lp.frequency.exponentialRampToValueAtTime(up?2400:280,at+dur*0.85);
    const g=ac.createGain();g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+dur*(up?0.7:0.2));g.gain.exponentialRampToValueAtTime(0.0001,at+dur);
    s.connect(lp);lp.connect(g);g.connect(chain(0,0.6));s.start(at,Math.random());s.stop(at+dur+0.05);
  }
  const t0=()=>ac.currentTime+0.004;
  let muted=false;
  return{
    mute(m){muted=!!m;AUDIO_MUTED=muted;if(out&&ac)out.gain.setTargetAtTime(muted?0:1.9,ac.currentTime,0.08);},
    get muted(){return muted;},
    drop(){if(on()){const L=ladder(Math.max(0,curK));bowl(t0(),mtof(L[10+Math.floor(Math.random()*6)]),0.016);}},
    gather(g){if(!on())return;if(g){air(t0(),1.3,0.032,true);bowl(t0()+0.06,mtof(ladder(Math.max(0,curK))[5]),0.022);}else{air(t0(),0.8,0.03,false);}},
    whoosh(){if(on())air(t0(),2.4,0.05,true);},
    ensure(){if(!ac)init();if(ac&&ac.state!=="running"){try{ac.resume();}catch(e){}}},
    get on(){return on();},
    now(){return ac?ac.currentTime:0;},
    phase(T){return on()?ac.currentTime*BREATH*TAU:T*BREATH*TAU;},
    pluck(gi,vel,delay,pan){if(on())pluck(gi,vel,t0()+(delay||0),pan);},
    tock(){if(on())wood(t0(),540,400,0.14,0.13,1900,0.05);},
    knock(){if(on())wood(t0(),300,235,0.11,0.12,1300,0.035);},
    tick(){if(on())wood(t0(),1900,1700,0.03,0.03,4000,0.02);},
    catch_(){if(on())wood(t0(),120,62,0.18,0.12,500,0.03);},
    click(pan,heavy){if(on())wood(t0()+Math.random()*0.006,heavy?1500:2200+Math.random()*600,heavy?1100:1900,heavy?0.05:0.035,heavy?0.05:0.035,heavy?2600:4200,heavy?0.04:0.03,pan);},
    reading(on_,k){if(!ac)return;const t=ac.currentTime;toneG.gain.setTargetAtTime(on_?0.05:0.0001,t,on_?2.2:0.5);
      if(k!==undefined&&k!==curK){curK=k;const f=mtof(tonicOf(k));for(const [o,m,d] of toneOsc)o.frequency.setTargetAtTime(f*m+d,t,1.6);}},
    bell(k,gain){if(on())bowl(t0(),mtof(tonicOf(k)),gain||0.035);},
    // one character sung as it leaves the globe
    sing(gi,delay,pan){
      if(!on())return;const at=t0()+Math.max(0,delay);const L=ladder(gChap[gi]),tone=TONE[gi];
      if(glyphs[gi]==="無"){const p=toneG.gain;p.setTargetAtTime(0.008,at,0.06);p.setTargetAtTime(0.05,at+0.9,0.5);return;}
      const dur=tone===5?0.3:tone===3?0.62:0.52;
      voices.push(syllable(at,mtof(L[NA[gi]]),mtof(L[NB[gi]]),tone,dur,VOW[gi]||"e",tone===5?0.05:0.085,pan||0));
      if(glyphs[gi]==="道")voices.push(bowl(at,mtof(L[0]-12),0.05));
      if(voices.length>60)voices.splice(0,voices.length-60);
    },
    say(gi){if(!on())return;const L=ladder(gChap[gi]),tone=TONE[gi];syllable(t0()+0.02,mtof(L[NA[gi]]),mtof(L[NB[gi]]),tone,tone===3?0.62:0.52,VOW[gi]||"e",0.1,0);},
    // a touch: what hasn't sounded yet never will; what is sounding fades
    hush(){if(!ac)return;const t=ac.currentTime;for(const v of voices){if(v.t>t+0.01){for(const o of v.nodes){try{o.stop(t);}catch(e){}}}else{v.env.gain.cancelScheduledValues(t);v.env.gain.setTargetAtTime(0.0001,t,0.1);}}voices=[];},
    inhale(){if(on())air(t0(),1.5,0.035,true);},
    exhale(){if(on())air(t0(),0.9,0.035,false);},
    sleep(h){if(!ac)return;try{if(h)ac.suspend();else ac.resume();}catch(e){}}
  };
})();

// a faint tick in the hand: Android vibrates; on iPhones (iOS 18+) a hidden switch gives the system tick
let HAPTIC_ON=true;
const haptic=(()=>{
  const canVib=typeof navigator.vibrate==="function";
  const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  let lab=null,last=0,armed=false;
  function ios(){if(!lab){lab=document.createElement("label");lab.setAttribute("aria-hidden","true");lab.style.cssText="position:absolute;left:-40px;top:-40px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";const i=document.createElement("input");i.type="checkbox";i.setAttribute("switch","");i.tabIndex=-1;lab.appendChild(i);document.body.appendChild(lab);}lab.click();}
  return{arm(){armed=true;},fire(ms){if(!armed||!HAPTIC_ON)return;if(window.NativeBridge&&window.NativeBridge.haptic){const t=performance.now();if(t-last<38)return;last=t;try{window.NativeBridge.haptic(ms|0);}catch(e){}return;}const t=performance.now();if(t-last<38)return;last=t;try{if(canVib)navigator.vibrate(ms);else if(isIOS)ios();}catch(e){}}};
})();

// ---------- state ----------
const STORE="uncarved-v3";
const pressed=new Uint8Array(N);let pressedN=0,cycle=1,seen=false;
const R={mode:"intro",cur:null,held:false,clock:0,posK:0,posS:0,stillDelay:0.9,introAt:0,started:false,autoRead:true,pauseAuto:false,once:false};
const U={lens:0,touchAmt:0,touchV:0,touch:[0,0,1],focus:-1,focusAmt:0,focusV:0,hiCell:[-9,-9],hiAmt:0,chapA:0,chapAAmt:0,chapB:-1,chapBAmt:0,dim:1,intro:reduce?1:0,bodyA:0,gat:[0,0,1],gatT0:0,gatS:0,gatOn:false};
const RIP=new Float32Array([0,0,1,-99,0,0,1,-99,0,0,1,-99,0,0,1,-99]);let ripI=0;
function ripple(m){RIP.set([m[0],m[1],m[2],simT],ripI*4);ripI=(ripI+1)%4;}
const unitModel=(x,y)=>{const w=hitWorld(x,y);if(!w||w[2]<0.05)return null;const m=toModel(w,[0,0,0]),l=Math.hypot(m[0],m[1],m[2])||1;return[m[0]/l,m[1]/l,m[2]/l];};
const STATS={plucks:0,tocks:0,clicks:0,knocks:0,frames:0};
let TS=1,simT=0;
function load(){
  try{const o=JSON.parse(localStorage.getItem(STORE)||"null");if(!o)return;
    if(o.k>=0&&o.k<NCH){R.posK=o.k;R.posS=clamp(o.s|0,0,STANZAS[o.k].length-1);}
    cycle=o.c||1;seen=!!o.seen;const b=atob(o.b||"");for(let i=0;i<N;i++)pressed[i]=(b.charCodeAt(i>>3)>>(i&7))&1;
  }catch(e){}
  // a pressed character carries the moment it was pressed; these press in as the globe forms
  pressedN=0;for(let i=0;i<N;i++)if(pressed[i]){pressedN++;pressArr.fill(1e-3,i*K,i*K+K);}
  gl.bindBuffer(gl.ARRAY_BUFFER,pressBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,pressArr);
}
function save(){try{const by=new Uint8Array(Math.ceil(N/8));for(let i=0;i<N;i++)if(pressed[i])by[i>>3]|=1<<(i&7);let t="";for(const v of by)t+=String.fromCharCode(v);localStorage.setItem(STORE,JSON.stringify({k:R.posK,s:R.posS,c:cycle,seen:seen?1:0,b:btoa(t)}));}catch(e){}}
function setPress(gi,val){pressArr.fill(val,gi*K,gi*K+K);gl.bindBuffer(gl.ARRAY_BUFFER,pressBuf);gl.bufferSubData(gl.ARRAY_BUFFER,gi*K*4,pressArr,gi*K,K);}
function pressGlyph(gi){if(pressed[gi])return;pressed[gi]=1;pressedN++;setPress(gi,Math.max(1e-3,simT));}
// everything read: after a breath the whole book rises again from the north pole, for the next time through
function raiseAll(){
  const T=simT+1.5;cycle++;for(let i=0;i<N;i++){pressed[i]=0;pressArr.fill(-(T+i/N*6),i*K,i*K+K);}pressedN=0;
  gl.bindBuffer(gl.ARRAY_BUFFER,pressBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,pressArr);save();audio.bell(0,0.05);
}

// ---------- reading: a passage rises off the globe one character at a time, and the globe turns under it like a record ----------
const PAUSE=[0,0.22,0.32,0.5];
function layout(S){
  const W=VW.W,H=VW.H-(S.wit?Math.min(S.wit.h,VW.H*0.42):0),maxW=Math.min(W*0.86,660),maxH=H*(S.wit?0.84:0.74);
  let zh=clamp(Math.min(W,H)/12,20,40),en=clamp(Math.min(W,H)/22,15,22);
  const phrases=[];let cur=[];
  for(let gi=S.a;gi<=S.b;gi++){cur.push(gi);if(/[，。；：！？、]/.test(after[gi])){phrases.push(cur);cur=[];}}
  if(cur.length)phrases.push(cur);
  for(let it=0;;it++){
    const cw=zh*1.08,per=Math.max(4,Math.floor(maxW/cw));
    const rows=[];let row=[];
    const push=cells=>{if(row.length&&row.length+cells.length>per){rows.push(row);row=[];}row=row.concat(cells);};
    for(const ph of phrases){
      const cells=[];for(const gi of ph){for(const c of before[gi])cells.push({p:c,o:gi});cells.push({g:gi});for(const c of after[gi])cells.push({p:c,o:gi});}
      if(cells.length<=per)push(cells);
      else{let i=0;while(i<cells.length){let j=Math.min(cells.length,i+per);while(j<cells.length&&cells[j].p!==undefined&&!OPENERS.includes(cells[j].p))j++;push(cells.slice(i,j));i=j;}}
    }
    if(row.length)rows.push(row);
    ox.font=`400 ${en}px ${FEN}`;
    const enL=[];
    S.lines.forEach((line,i)=>{let c="";for(const w of line.split(" ")){const t=c?c+" "+w:w;if(c&&ox.measureText(t).width>maxW){enL.push({s:c,i});c=w;}else c=t;}enL.push({s:c,i});});
    const hd=zh*0.62,lhZ=zh*1.32,lhE=en*1.5,gapZE=zh*0.85,hdGap=zh*0.9;
    const h=hd+hdGap+rows.length*lhZ+gapZE+enL.length*lhE;
    if(h<=maxH||it>=7){
      const y0=Math.max(10,(H-h)/2),tgt=new Map(),punct=[],yz=y0+hd+hdGap;
      rows.forEach((r,ri)=>{const y=yz+ri*lhZ+lhZ/2,x0=(W-r.length*cw)/2+cw/2;r.forEach((c,ci)=>{const x=x0+ci*cw;if(c.g!==undefined)tgt.set(c.g,{x,y});else punct.push({p:c.p,o:c.o,x,y});});});
      const ye=yz+rows.length*lhZ+gapZE;
      return{zh,en,hd,hdY:y0+hd/2,tgt,punct,enL:enL.map((l,j)=>({s:l.s,i:l.i,y:ye+j*lhE+lhE/2}))};
    }
    zh*=0.9;en=Math.max(12,en*0.93);
  }
}
function witFill(k,s){
  const rows=WIT[(k+1)+"."+s],note=WNOTE[(k+1)+"."+s],el=$("wit");
  if(!rows){el.innerHTML="";return null;}
  let tot=0,lit=0,h='<div class="hd">these lines in other editions</div>';
  for(const[e,t,m,o]of rows){
    const om=new Set(o);let z="";const cs=[...t];
    cs.forEach((c,i)=>{if(om.has(i))z+="<u>·</u>";z+=c==="□"?"<i>□</i>":m[i]==="1"?"<b>"+esc(c)+"</b>":esc(c);if(m[i]==="1")lit++;});
    tot+=cs.length;h+=`<div class="r"><span class="ed">${WED[e]}</span><span class="zh">${z}</span></div>`;
  }
  if(note)h+=`<div class="nt">${esc(note)}</div>`;
  h+=`<div class="more">compare all editions ›</div>`;
  const narrow=VW.W<480;el.style.setProperty("--wz",((tot>160?13:tot>100?14.5:16)-(narrow&&tot>60?1:0))+"px");
  el.innerHTML=h;
  return{tot,lit,h:el.offsetHeight+18};
}
function makeStanza(k,s,fromSlot,firstOfChapter){
  const Z=STANZAS[k][s],n=Z.b-Z.a+1;
  const wit=witFill(k,s);
  const words=Z.lines.join(" ").split(/\s+/).filter(Boolean).length;
  const base=reduce?0.14:clamp(words/2.2/n,0.24,0.52);
  const dist=Math.abs(slotOf[Z.a]-fromSlot);
  const lead=firstOfChapter?1.9:clamp(0.55+dist*0.012,0.55,1.7);
  const lift=new Float64Array(n);let t=lead;
  for(let j=0;j<n;j++){lift[j]=t;t+=base+(PAUSE[+PUNCT[Z.a+j]]||0);}
  const flight=reduce?0.5:1.05,shown=lift[n-1]+flight;
  const lens=Z.lines.map(l=>l.length),tot=lens.reduce((a,b)=>a+b,0)||1;
  let c=0;const lineT=lens.map(L=>{const v=lift[0]+0.6+c/tot*(shown-lift[0]-0.4);c+=L;return v;});
  const lastWords=(Z.lines[Z.lines.length-1]||"").split(/\s+/).length;
  const tRet=Math.max(shown+2.2+words*0.09,lineT[lineT.length-1]+1.6+lastWords*0.28)+(wit?clamp(2.2+wit.tot*0.035+wit.lit*0.05,2.4,7):0);
  const ret=new Float64Array(n);for(let j=0;j<n;j++)ret[j]=tRet+j*0.034;
  const S={wit,witIn:lineT[lineT.length-1]+0.9,k,s,a:Z.a,b:Z.b,n,lines:Z.lines,lift,ret,flight,retDur:0.72,lineT,enOut:tRet,end:ret[n-1]+0.72+0.45,from:fromSlot,lead,lifted:0,landed:0,voiced:0,aborted:false,first:firstOfChapter,pos:[],rf:[]};
  S.lay=layout(S);
  $("live").textContent=glyphs.slice(Z.a,Z.b+1).join("")+" — "+Z.lines.join(" ");
  return S;
}
function startReading(k,s,first){
  const S=makeStanza(k,s,V.s,first);R.cur=S;R.clock=0;R.held=false;R.mode="read";R.posK=k;R.posS=s;save();emit("read",{k:k+1,s});
  V.detent=null;
  audio.reading(true,k);
  if(first)audio.bell(k,0.04);
}
function nextOf(k,s){return s+1<STANZAS[k].length?[k,s+1,false]:[(k+1)%NCH,0,true];}
// a drag: whatever has risen falls straight back, whatever hasn't stays put
function abortReading(){
  const S=R.cur;if(!S||S.aborted)return;S.aborted=true;audio.hush();audio.exhale();R.held=false;
  const c=R.clock;
  for(let j=0;j<S.n;j++){if(j>=S.lifted){S.lift[j]=Infinity;S.ret[j]=Infinity;}else{const r=c+(j-S.landed)*0.012;if(S.ret[j]>r)S.ret[j]=Math.max(r,c);}}
  S.retDur=0.42;S.enOut=Math.min(S.enOut,c);
  S.end=(S.lifted>S.landed?S.ret[S.lifted-1]:c)+S.retDur+0.05;
  audio.reading(false);
}
function stepReading(dt){
  const S=R.cur;if(!S)return;
  if(!R.held)R.clock+=dt;
  const c=R.clock;
  while(S.lifted<S.n&&c>=S.lift[S.lifted])S.lifted++;
  if(!R.held&&!S.aborted){while(S.voiced<S.n&&S.lift[S.voiced]<c+0.12){const gi=S.a+S.voiced,tg=S.lay.tgt.get(gi);audio.sing(gi,S.lift[S.voiced]-c,tg?(tg.x/VW.W*2-1)*0.45:0);S.voiced++;}}
  if(!S.aborted&&!S.inhaled&&c>=S.enOut-0.4){S.inhaled=true;audio.inhale();}
  while(S.landed<S.lifted&&c>=S.ret[S.landed]+S.retDur){
    const gi=S.a+S.landed,p=S.pos[S.landed];STATS.clicks++;audio.click(p?(p.x/VW.W*2-1)*0.6:0,!S.aborted);
    if(!S.aborted)pressGlyph(gi);
    S.landed++;
  }
  if(c>=S.end){
    if(S.aborted){R.cur=null;R.mode="free";V.detent=null;V.settled=false;return;}
    save();
    if(pressedN>=N)raiseAll();
    emit("passageEnd",{k:S.k+1,s:S.s,once:R.once});
    if(R.once){R.once=false;R.cur=null;R.mode="free";R.pauseAuto=true;V.detent=null;V.settled=false;return;}
    const[k,s,first]=nextOf(S.k,S.s);startReading(k,s,first);
  }
}
// where the needle should be while reading: on the character that is about to rise, moving on as each one leaves
function readSlot(S,c){
  const s0=slotOf[S.a];
  if(c<S.lift[0]){const u=ease(c/(S.lift[0]*0.85));return lerp(S.from,s0,u);}
  for(let j=0;j<S.n-1;j++){if(c<S.lift[j+1]){const gap=S.lift[j+1]-S.lift[j],u=ease((c-S.lift[j])/Math.min(0.32,gap));return lerp(slotOf[S.a+j],slotOf[S.a+j+1],u);}}
  return slotOf[S.b];
}
const nearYaw=a=>a+TAU*Math.round((V.yaw-a)/TAU);

// ---------- drawing the reading layer ----------
const HALO="rgba(11,13,18,0.9)";
const SPR=1.5;
function sprite(w,h,draw){const c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(w*DPR*SPR));c.height=Math.max(1,Math.ceil(h*DPR*SPR));const g=c.getContext("2d");g.scale(DPR*SPR,DPR*SPR);g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";draw(g);return c;}
function sprites(S){
  const L=S.lay,box=L.zh*1.5,fz=`700 ${L.zh.toFixed(1)}px ${FZH}`;L.box=box;L.gs=new Map();
  for(let gi=S.a;gi<=S.b;gi++){const ch=glyphs[gi];L.gs.set(gi,{
    bone:sprite(box,box,g=>{g.font=fz;g.lineWidth=Math.max(2,L.zh*0.14);g.strokeStyle=HALO;g.strokeText(ch,box/2,box/2);g.fillStyle="#ece2cc";g.fillText(ch,box/2,box/2);}),
    red:sprite(box,box,g=>{g.font=fz;g.fillStyle="#d9482b";g.fillText(ch,box/2,box/2);}),
    gold:sprite(box,box,g=>{g.font=fz;g.lineWidth=Math.max(2,L.zh*0.14);g.strokeStyle=HALO;g.strokeText(ch,box/2,box/2);g.fillStyle="#f2c46b";g.fillText(ch,box/2,box/2);})});}
  L.ps=new Map();for(const q of L.punct)if(!L.ps.has(q.p))L.ps.set(q.p,sprite(box,box,g=>{g.font=fz;g.fillStyle="#9d9584";g.fillText(q.p,box/2,box/2);}));
  const fe=`400 ${L.en.toFixed(1)}px ${FEN}`;ox.font=fe;
  for(const l of L.enL){const w=ox.measureText(l.s).width+14,h=L.en*1.7;l.w=w;l.h=h;
    l.img=sprite(w,h,g=>{g.font=fe;g.lineWidth=4;g.strokeStyle=HALO;g.strokeText(l.s,w/2,h/2);g.fillStyle="#e6dcc6";g.fillText(l.s,w/2,h/2);});}
  const ht=`第${cn(S.k+1)}章　${CH[S.k][0]}`,hf=`700 ${(L.zh*0.5).toFixed(1)}px ${FZH}`;ox.font=hf;const hw=ox.measureText(ht).width+20;
  L.hdImg={w:hw,h:L.zh,img:sprite(hw,L.zh,g=>{g.font=hf;g.fillStyle="#9d9584";g.fillText(ht,hw/2,L.zh/2);})};
}
const snap=v=>Math.round(v*DPR)/DPR;
const tmp={};
let ovDirty=false;
function drawReading(){
  const S=R.cur;if(!S){return;}
  const L=S.lay;if(!L.gs)sprites(S);
  const c=R.clock,box=L.box;
  for(let j=0;j<S.lifted;j++){
    if(j<S.landed)continue;
    const gi=S.a+j,tg=L.tgt.get(gi);if(!tg)continue;
    glyphScreen(gi,tmp);
    const home=Math.min(1.25,tmp.s*0.84/L.zh);
    const up=(c-S.lift[j])/S.flight,eu=ease(up),down=(c-S.ret[j])/S.retDur;
    let x,y,sc,w;
    if(down<=0){
      x=lerp(tmp.x,tg.x,eu);y=lerp(tmp.y,tg.y,eu);
      sc=lerp(home,1,eu)*(1+0.22*Math.sin(Math.PI*clamp(up,0,1)));w=soft(up*1.3);
      if(reduce){x=tg.x;y=tg.y;sc=1;}
    }else{
      // home from wherever it is now, speeding up into its hole
      const r=S.rf[j]||(S.rf[j]=S.pos[j]?{x:S.pos[j].x,y:S.pos[j].y,sc:S.pos[j].sc,w:S.pos[j].w}:{x:tg.x,y:tg.y,sc:1,w:1});
      const ed=inQuad(down);x=lerp(r.x,tmp.x,ed);y=lerp(r.y,tmp.y,ed);sc=lerp(r.sc,home,ed)*(1+0.18*Math.sin(Math.PI*clamp(down,0,1)));w=r.w*(1-ed);
    }
    S.pos[j]={x,y,s:box*sc,sc,w};
    const sz=box*sc;if(Math.abs(sc-1)<0.002){x=snap(x);y=snap(y);}
    const Gs=L.gs.get(gi),isF=INFO.gi===gi&&INFO.risen;
    if(isF){ox.globalAlpha=1;ox.drawImage(Gs.gold,x-sz/2,y-sz/2,sz,sz);continue;}
    if(w<1){ox.globalAlpha=1-w;ox.drawImage(Gs.red,x-sz/2,y-sz/2,sz,sz);}
    if(w>0){ox.globalAlpha=w;ox.drawImage(Gs.bone,x-sz/2,y-sz/2,sz,sz);}
  }
  for(const q of L.punct){
    const j=q.o-S.a;if(!(j<S.lifted))continue;
    const a=soft((c-S.lift[j]-S.flight*0.7)/0.45)*(1-soft((c-S.ret[j])/0.3));if(a<=0.004)continue;
    ox.globalAlpha=a;ox.drawImage(L.ps.get(q.p),snap(q.x-box/2),snap(q.y-box/2),box,box);
  }
  const out=soft((c-S.enOut)/0.6);
  const ha=soft((c-S.lift[0]+0.4)/0.8)*(1-out)*(S.first?1:0.7);
  if(ha>0.004){const h=L.hdImg;ox.globalAlpha=ha;ox.drawImage(h.img,snap(VW.W/2-h.w/2),snap(L.hdY-h.h/2),h.w,h.h);}
  for(const l of L.enL){
    const ain=soft((c-S.lineT[l.i])/1.1),a=ain*(1-out);if(a<=0.004)continue;
    ox.globalAlpha=a;ox.drawImage(l.img,snap(VW.W/2-l.w/2),snap(l.y+(1-ain)*8-l.h/2),l.w,l.h);
  }
  ox.globalAlpha=1;
}

// ---------- the card for one character ----------
const INFO={gi:-1,risen:false,fromRead:false};
const PYT={"ā":1,"ē":1,"ī":1,"ō":1,"ū":1,"ǖ":1,"á":2,"é":2,"í":2,"ó":2,"ú":2,"ǘ":2,"ǎ":3,"ě":3,"ǐ":3,"ǒ":3,"ǔ":3,"ǚ":3,"à":4,"è":4,"ì":4,"ò":4,"ù":4,"ǜ":4};
const toneOfPy=p=>{for(const c of p)if(PYT[c])return PYT[c];return 5;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function openInfo(gi,risen){
  const c=glyphs[gi],G=GLOSS[c]||[],key=KEY[c],t=TONE[gi];
  const e=G.find(r=>toneOfPy(r[0])===t)||G[0]||["",0,""];
  const senses=(()=>{const t=e[2]||"",a=t.split("; ").filter(x=>!/^(surname|short name|abbr|old variant|variant of|CL:|used in|see )/i.test(x));return (a.length?a:t.split("; ")).slice(0,4).join("; ");})();
  $("iBig").textContent=c;
  $("iPy").innerHTML=esc(e[0])+(key?`<i>${esc(key.en)}</i>`:"");
  $("iGl").textContent=key?key.note:senses;
  const k=gChap[gi],n=COUNT.get(c)||1;
  $("iCt").innerHTML=`${n===1?"once":n+" times"} in the book · here in <b>第${cn(k+1)}章 ${esc(CH[k][0])}</b>`;
  $("info").classList.add("on");$("where").classList.remove("on");
  INFO.gi=gi;INFO.risen=risen;U.focus=risen?-1:gi;
  const ci=uIndex.get(c);U.hiCell=[ci%GRID,Math.floor(ci/GRID)];
  audio.say(gi);haptic.fire(8);
}
function closeInfo(){if(INFO.gi<0)return;INFO.gi=-1;$("info").classList.remove("on");audio.click(0,false);}

// ---------- touch ----------
const ptr={id:null,x0:0,y0:0,x:0,y:0,t0:0,moved:false,grab:null,samples:[],wasFast:false,reading:false};
let wheelUntil=0;
const SLOP=7;
function pickSphere(x,y){
  let best=-1,bd=1e9;const lim=Math.max(16,VW.charPx*VW.mag*0.9);
  for(let gi=0;gi<N;gi++){const fz=VW.M[2]*P[gi*3]+VW.M[5]*P[gi*3+1]+VW.M[8]*P[gi*3+2];if(fz<0.15)continue;
    glyphScreen(gi,tmp);const d=Math.hypot(tmp.x-x,tmp.y-y);if(d<bd){bd=d;best=gi;}}
  return bd<=lim?best:-1;
}
function pickRisen(x,y){
  const S=R.cur;if(!S||!S.lay.box)return -1;let best=-1,bd=1e9;
  for(let j=S.landed;j<S.lifted;j++){const p=S.pos[j];if(!p)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=S.a+j;}}
  return bd<=S.lay.box*0.6?best:-1;
}
function rotateTo(x,y,dx,dy){
  const w=hitWorld(x,y);
  if(w&&w[2]>0.3){
    if(!ptr.grab){ptr.grab=toModel(w,[0,0,0]);return;}
    const m=ptr.grab,rho2=m[0]*m[0]+m[2]*m[2];
    let ax=w[0];if(ax*ax>rho2)ax=Math.sign(ax)*Math.sqrt(rho2)*0.9999;
    let az=Math.sqrt(Math.max(0,rho2-ax*ax));
    const azNow=-m[0]*Math.sin(V.yaw)+m[2]*Math.cos(V.yaw);if(azNow<0)az=-az;
    let pitch=Math.atan2(w[2],w[1])-Math.atan2(az,m[1]);
    let yaw=Math.atan2(ax,az)-Math.atan2(m[0],m[2]);
    pitch+=TAU*Math.round((V.pitch-pitch)/TAU);yaw+=TAU*Math.round((V.yaw-yaw)/TAU);
    if(pitch>PMAX||pitch<-PMAX){pitch=clamp(pitch,-PMAX,PMAX);}
    V.yaw=yaw;V.pitch=pitch;
  }else{ptr.grab=null;V.yaw+=dx/VW.Rpx;V.pitch=clamp(V.pitch+dy/VW.Rpx,-PMAX,PMAX);}
  setRot();
}
function markSeen(){if(!seen){seen=true;save();}$("hint").classList.remove("on");}
function beginDrag(){markSeen();
  if(R.mode==="read"&&R.cur)abortReading();
  if(R.mode==="intro"){R.mode="free";U.intro=Math.max(U.intro,0.999);}
  canvas.classList.add("grab");
}
canvas.addEventListener("pointerdown",e=>{
  if(ptr.id!==null)return;
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  audio.ensure();haptic.arm();markSeen();
  ptr.id=e.pointerId;ptr.x0=ptr.x=e.clientX;ptr.y0=ptr.y=e.clientY;ptr.t0=e.timeStamp||performance.now();ptr.moved=false;ptr.samples=[{t:ptr.t0,yaw:V.yaw,pitch:V.pitch}];
  const w=hitWorld(e.clientX,e.clientY);ptr.grab=w?toModel(w,[0,0,0]):null;
  if(ptr.grab){U.touch=ptr.grab.slice();U.touchV=Math.max(U.touchV,0);}
  const fast=Math.abs(V.vy)>1.2;ptr.wasFast=fast;if(fast){audio.catch_();haptic.fire(10);}
  V.vy=0;V.vp=0;V.detent=null;V.settled=false;V.pcoast=false;
  ptr.reading=R.mode==="read"&&R.cur&&!R.cur.aborted;
  ptr.onGlobe=!!ptr.grab;
  R.pauseAuto=false;clearTimeout(ptr.lp);ptr.gath=false;
  if(ptr.grab&&!(R.mode==="read"&&R.cur&&!R.cur.aborted)&&R.mode!=="cast"){ptr.lp=setTimeout(()=>{if(ptr.id!==null&&!ptr.moved){ptr.gath=true;startGather(unitModel(ptr.x,ptr.y)||ptr.grab);}},380);}
  if(R.cur&&!R.cur.aborted)audio.reading(true,R.cur.k);
  if(ptr.reading){R.held=true;audio.hush();R.cur.voiced=R.cur.lifted;}
});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerId!==ptr.id)return;
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];const last=evs.length?evs[evs.length-1]:e;
  const x=last.clientX,y=last.clientY,dx=x-ptr.x,dy=y-ptr.y;ptr.x=x;ptr.y=y;
  if(ptr.gath){const m=unitModel(x,y);if(m)U.gat=m;return;}
  if(!ptr.moved&&Math.hypot(x-ptr.x0,y-ptr.y0)>SLOP){ptr.moved=true;clearTimeout(ptr.lp);beginDrag();}
  if(!ptr.moved)return;
  rotateTo(x,y,dx,dy);
  if(ptr.grab)U.touch=ptr.grab.slice();
  const t=last.timeStamp||e.timeStamp||performance.now();ptr.samples.push({t,yaw:V.yaw,pitch:V.pitch});while(ptr.samples.length>2&&t-ptr.samples[0].t>110)ptr.samples.shift();
});
function endPointer(e,cancel){
  if(e.pointerId!==ptr.id)return;
  try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
  ptr.id=null;canvas.classList.remove("grab");audio.ensure();
  clearTimeout(ptr.lp);if(ptr.gath){ptr.gath=false;endGather();return;}
  if(!ptr.moved&&!cancel){tap(ptr.x0,ptr.y0);return;}
  if(!ptr.moved){if(ptr.reading)R.held=false;return;}
  const t=e.timeStamp||performance.now(),sm=ptr.samples,last=sm[sm.length-1];
  let vy=0,vp=0;
  if(sm.length>=2&&t-last.t<70){const f=sm[0],dt=Math.max(0.016,(last.t-f.t)/1000);vy=(last.yaw-f.yaw)/dt;vp=(last.pitch-f.pitch)/dt;}
  V.vy=clamp(vy,-13,13);V.vp=clamp(vp,-6,6);V.pcoast=Math.abs(V.vp)>0.6;V.detent=null;V.settled=false;
}
canvas.addEventListener("pointerup",e=>endPointer(e,false));
canvas.addEventListener("pointercancel",e=>endPointer(e,true));
canvas.addEventListener("lostpointercapture",e=>{if(e.pointerId===ptr.id)endPointer(e,true);});
function startGather(m){if(!m)return;U.gat=m.slice();U.gatT0=simT;U.gatOn=true;if(R.mode==="intro"){R.mode="free";U.intro=Math.max(U.intro,0.999);}audio.hush();audio.gather(true);haptic.fire(16);V.settled=false;emit("gather",{});}
function endGather(){U.gatOn=false;audio.gather(false);haptic.fire(10);V.settled=false;V.settledAt=simT;}
function tap(x,y){
  {const m=unitModel(x,y);if(m){ripple(m);audio.drop();haptic.fire(6);}}
  if(INFO.gi>=0){
    // another character: the card moves to it; anywhere else (or the same one) closes it
    const fr=INFO.fromRead&&R.cur&&!R.cur.aborted,gi=fr?pickRisen(x,y):pickSphere(x,y);
    if(gi>=0&&gi!==INFO.gi){openInfo(gi,fr);INFO.fromRead=fr;return;}
    closeInfo();if(fr)R.held=false;else V.settledAt=simT;return;}
  if(R.mode==="read"&&R.cur&&!R.cur.aborted&&R.cur.lay&&Math.abs(y-R.cur.lay.hdY)<R.cur.lay.zh*0.75){emit("openChapter",{k:R.cur.k+1,s:R.cur.s});return;}
  if(R.mode==="read"&&R.cur&&!R.cur.aborted){
    const gi=pickRisen(x,y);if(gi>=0){openInfo(gi,true);INFO.fromRead=true;return;}
    R.held=false;return;
  }
  const gi=pickSphere(x,y);
  if(gi>=0){openInfo(gi,false);INFO.fromRead=false;if(R.mode==="intro")R.mode="free";}
}
// a trackpad or wheel turns it too
canvas.addEventListener("wheel",e=>{
  e.preventDefault();audio.ensure();
  let dx=e.deltaX,dy=e.deltaY;if(e.deltaMode===1){dx*=16;dy*=16;}
  if(e.shiftKey&&!dx){dx=dy;dy=0;}
  if(performance.now()>wheelUntil){beginDrag();V.vy=0;V.vp=0;}
  wheelUntil=performance.now()+140;V.detent=null;V.settled=false;
  V.yaw-=dx/VW.Rpx;V.pitch=clamp(V.pitch-dy/VW.Rpx*0.6,-PMAX,PMAX);setRot();
},{passive:false});
canvas.addEventListener("keydown",e=>{
  audio.ensure();
  if(e.key==="Escape"){closeInfo();return;}
  const dir=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0,row=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0;
  if(!dir&&!row)return;e.preventDefault();beginDrag();
  let s;if(dir){s=nearestGlyph(Math.round(V.s)+dir,dir);}else{s=nearestGlyph(slotForPhi(phiAt(V.s)+row*TAU),row);}
  V.detent={slot:s,yaw:nearYaw(-SPHI[s]),lat:SLAT[s],hit:false};V.settled=false;
  if(row){V.s=s;V.q=s;V.chap=gChap[glyphAt[s]];audio.pluck(glyphAt[s],0.2,0,0);}
});

// ---------- the globe in your hand ----------
function physics(dt){
  if(R.mode==="cast")return;
  if(ptr.id!==null&&ptr.moved)return;
  if(performance.now()<wheelUntil)return;
  if(R.mode==="read"&&R.cur&&!R.cur.aborted){
    if(R.held)return;
    const sT=readSlot(R.cur,R.clock),yT=nearYaw(-phiAt(sT)),pT=latAt(sT);
    const w=8,z=1;V.vy+=(w*w*(yT-V.yaw)-2*z*w*V.vy)*dt;V.vp+=(w*w*(pT-V.pitch)-2*z*w*V.vp)*dt;
    V.yaw+=V.vy*dt;V.pitch+=V.vp*dt;return;
  }
  if(ptr.id!==null)return;
  const charYaw=STEP/Math.max(0.12,Math.cos(latAt(V.s))),sp=Math.abs(V.vy)/charYaw;
  if(!V.detent){
    V.vy*=Math.exp(-0.75*dt);const dry=1.6*charYaw*dt;V.vy=Math.abs(V.vy)<=dry?0:V.vy-Math.sign(V.vy)*dry;
    if(sp<4.2&&!V.pcoast){
      const dir=V.vy>0.0001?-1:V.vy<-0.0001?1:0;
      const k=nearestGlyph(dir?V.s+dir*Math.max(0.5,sp*0.22):V.s,dir);
      V.detent={slot:k,yaw:nearYaw(-SPHI[k]),lat:SLAT[k],hit:false};
    }
  }
  if(V.detent){const w=17,z=0.5;V.vy+=(w*w*(V.detent.yaw-V.yaw)-2*z*w*V.vy)*dt;}
  V.yaw+=V.vy*dt;
  if(V.pcoast){V.vp*=Math.exp(-3.2*dt);if(Math.abs(V.vp)<0.45)V.pcoast=false;}
  else{const pT=V.detent?V.detent.lat:latAt(V.s),w=12,z=0.85;V.vp+=(w*w*(pT-V.pitch)-2*z*w*V.vp)*dt;}
  V.pitch+=V.vp*dt;
  if(V.pitch>PMAX){V.pitch=PMAX;V.vp=-Math.abs(V.vp)*0.3;}else if(V.pitch<-PMAX){V.pitch=-PMAX;V.vp=Math.abs(V.vp)*0.3;}
  if(V.detent){
    const err=Math.abs(V.detent.yaw-V.yaw);
    if(!V.detent.hit&&err<charYaw*0.12){V.detent.hit=true;STATS.knocks++;audio.knock();haptic.fire(9);}
    if(!V.settled&&err<charYaw*0.02&&Math.abs(V.vy)<charYaw*0.08&&Math.abs(V.pitch-V.detent.lat)<0.003){V.settled=true;V.settledAt=simT;}
  }
}
// what passes under the lens: plucks, a woodblock at each chapter, a tick when you change grooves
let lastPluckT=0,pluckBudget=0;
function updateHead(dt){
  const prev=V.s,s=headFrom(V.yaw,V.pitch,prev);V.s=s;
  const hs=nearestGlyph(s,0),hg=glyphAt[hs];V.head=hg;
  if(gChap[hg]!==U.chapA){U.chapB=U.chapA;U.chapBAmt=U.chapAAmt;U.chapA=gChap[hg];U.chapAAmt=0;}
  const silent=(R.mode==="read"&&R.cur&&!R.cur.aborted)||R.mode==="intro";
  if(silent){V.chap=gChap[hg];V.q=Math.round(s);return;}
  const ds=s-prev;
  if(Math.abs(ds)>40){STATS.ticks=(STATS.ticks||0)+1;audio.tick();haptic.fire(5);V.chap=gChap[hg];V.q=Math.round(s);return;}
  // a character sounds as the lens moves onto it; a little hysteresis so a globe at rest never chatters
  const crossed=[];let q=V.q;
  while(s>q+0.62){q++;const gi=glyphAt[q];if(gi>=0)crossed.push(gi);}
  while(s<q-0.62){q--;const gi=glyphAt[q];if(gi>=0)crossed.push(gi);}
  V.q=q;
  if(!crossed.length)return;
  const rate=Math.abs(ds)/Math.max(dt,1e-3),vel=clamp(rate/26,0,1);
  pluckBudget=Math.min(3,pluckBudget+dt*30);
  const n=crossed.length;let played=0;
  for(let i=0;i<n;i++){
    const gi=crossed[i];
    if(gChap[gi]!==V.chap){V.chap=gChap[gi];STATS.tocks++;audio.tock();haptic.fire(10);}
    if(pluckBudget>=1&&(n<=3||i%Math.ceil(n/3)===0)){pluckBudget-=1;played++;STATS.plucks++;audio.pluck(gi,vel,dt*i/n,0);}
  }
  if(rate<11)haptic.fire(4);
}

// ---------- the frame ----------
const where=$("where");let whereK=-1,whereUntil=0;
let PAUSED=false;
function frame(now){
  if(PAUSED){frame.stopped=true;return;}
  const realT=now/1000,rdt=Math.min(0.05,Math.max(0,realT-(frame.last||realT)));frame.last=realT;STATS.frames++;
  tick(rdt);render();requestAnimationFrame(frame);
}
function tick(rdt){
  const dt=rdt*TS,pdt=Math.min(0.033,rdt);simT+=dt;
  // intro: the characters rise out of the stone, north to south
  if(R.mode==="intro"||U.intro<1){U.intro=Math.min(1,U.intro+dt/(reduce?0.3:1.6));}
  U.bodyA=Math.min(1,U.bodyA+dt/0.5);
  if(R.mode==="intro"&&U.intro>=1&&simT-R.introAt>2.0){const[k,s]=[R.posK,R.posS];startReading(k,s,s===0);if(!seen)$("hint").classList.add("on");}
  physics(pdt);setRot();updateHead(pdt);
  // stillness: once the globe has clicked into place and nothing touches it, the passage under the lens rises
  if(R.mode==="cast"&&CAST)stepCast();
  if(R.mode==="free"&&R.autoRead&&!R.pauseAuto&&ptr.id===null&&performance.now()>wheelUntil&&INFO.gi<0&&V.settled&&simT-V.settledAt>R.stillDelay){
    const gi=V.head>=0?V.head:0,k=gChap[gi],s=stOf[gi];startReading(k,s,s===0);
  }
  if(R.mode==="read")stepReading(dt);
  // springs and fades
  const touching=ptr.id!==null;
  {const tgt=touching&&ptr.onGlobe?1:0,w=touching?38:22,z=touching?0.8:0.38;U.touchV+=(w*w*(tgt-U.touchAmt)-2*z*w*U.touchV)*dt;U.touchAmt=clamp(U.touchAmt+U.touchV*dt,-0.3,1.3);}
  {const tgt=INFO.gi>=0&&!INFO.risen?1:0,w=20,z=0.42;U.focusV+=(w*w*(tgt-U.focusAmt)-2*z*w*U.focusV)*dt;U.focusAmt+=U.focusV*dt;if(tgt===0&&U.focusAmt<0.01&&Math.abs(U.focusV)<0.05){U.focusAmt=0;U.focus=-1;}}
  U.hiAmt=lerp(U.hiAmt,INFO.gi>=0?1:0,1-Math.exp(-dt*9));
  U.chapAAmt=Math.min(1,U.chapAAmt+dt/0.35);U.chapBAmt=Math.max(0,U.chapBAmt-dt/0.35);
  const S=R.cur,risen=S&&S.lifted>S.landed&&R.clock<S.enOut+0.3;
  U.dim=lerp(U.dim,risen?0.36:1,1-Math.exp(-dt*(risen?2.5:4)));
  U.gatS=lerp(U.gatS,U.gatOn?1:0,1-Math.exp(-dt*(U.gatOn?3.0:2.2)));
  U.lens=lerp(U.lens,R.mode==="intro"?0:1,1-Math.exp(-dt*3));
  // the chapter you are turning past, named at the bottom
  const freeish=R.mode==="free"||(R.mode==="read"&&R.cur&&R.cur.aborted);
  const moving=freeish&&(touching||Math.abs(V.vy)>0.02||!V.settled||performance.now()<wheelUntil);
  if(moving&&INFO.gi<0){whereUntil=simT+1.4;if(V.chap!==whereK){whereK=V.chap;where.innerHTML=`第${cn(whereK+1)}章　${CH[whereK][0]}<small>chapter ${whereK+1}</small>`;}}
  where.classList.toggle("on",simT<whereUntil&&freeish&&INFO.gi<0);
  {const S=R.cur,on=!!(S&&S.wit&&!S.aborted&&R.mode==="read"&&R.clock>=S.witIn&&R.clock<S.enOut+0.15&&INFO.gi<0);if(on!==U.witOn){U.witOn=on;$("wit").classList.toggle("on",on);}}
  {const on=R.mode==="intro"||(R.cur&&R.cur.first&&R.cur.lifted===0&&!R.cur.aborted&&!U.titleDone);if(!on&&R.cur&&R.cur.lifted>0)U.titleDone=true;if(on!==U.titleOn){U.titleOn=on;$("title").classList.toggle("on",on);}}
}
function render(){
  gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(B.p);gl.uniformMatrix3fv(B.U.uRot,false,VW.M);gl.uniform1f(B.U.uDim,U.dim);gl.uniform1f(B.U.uA,U.bodyA);
  gl.bindVertexArray(bVAO);gl.drawElements(gl.TRIANGLES,bCount,gl.UNSIGNED_SHORT,0);
  if(atlasReady){
    const S=R.cur;
    gl.useProgram(G.p);const u=G.U;
    gl.uniformMatrix3fv(u.uRot,false,VW.M);gl.uniform1f(u.uT,simT);gl.uniform1f(u.uIntro,U.intro);gl.uniform1f(u.uLens,U.lens);
    gl.uniform3fv(u.uNeedle,VW.needle);gl.uniform3fv(u.uTouch,U.touch);gl.uniform1f(u.uTouchAmt,Math.max(0,U.touchAmt));
    gl.uniform2fv(u.uHiCell,U.hiCell);gl.uniform1f(u.uHiAmt,U.hiAmt);gl.uniform1f(u.uFocus,U.focus);gl.uniform1f(u.uFocusAmt,Math.max(-0.2,U.focusAmt));
    gl.uniform1f(u.uChapA,U.chapA);gl.uniform1f(u.uChapAAmt,U.chapAAmt);gl.uniform1f(u.uChapB,U.chapB);gl.uniform1f(u.uChapBAmt,U.chapBAmt);
    if(S&&S.lifted>S.landed){gl.uniform1f(u.uHoleA,S.a+S.landed);gl.uniform1f(u.uHoleB,S.a+S.lifted-1);}else{gl.uniform1f(u.uHoleA,-10);gl.uniform1f(u.uHoleB,-10);}
    gl.uniform1f(u.uDim,U.dim);
    gl.uniform4fv(u.uRip,RIP);gl.uniform4fv(u.uGat,[U.gat[0],U.gat[1],U.gat[2],U.gatT0]);gl.uniform1f(u.uGatS,U.gatS);
    gl.bindVertexArray(gVAO);gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,INST);gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  }
  gl.bindVertexArray(null);
  if(R.cur||ovDirty){ox.setTransform(DPR,0,0,DPR,0,0);ox.clearRect(0,0,VW.W,VW.H);ovDirty=!!R.cur;if(R.cur&&atlasReady)drawReading();}
}

// ---------- ask the Way: the globe is spun and lands on a passage ----------
let CAST=null;
function flyTo(k,s,spin,dur,why){
  if(R.cur&&!R.cur.aborted)abortReading();R.cur=null;closeInfo();
  const gi=STANZAS[k][s].a,sl=slotOf[gi];
  let y1=nearYaw(-SPHI[sl]);if(spin){y1+=(Math.random()<0.5?-1:1)*spin*TAU;}
  CAST={t0:simT,dur,y0:V.yaw,p0:V.pitch,y1,p1:SLAT[sl],k,s,why};R.mode="cast";R.pauseAuto=false;V.vy=V.vp=0;V.detent=null;V.settled=false;
  if(U.intro<1)U.intro=0.999;
  if(why==="cast"){audio.ensure();audio.whoosh();haptic.fire(22);}
  emit("fly",{k:k+1,s,why});
}
function stepCast(){
  const c=CAST,t=clamp((simT-c.t0)/c.dur,0,1),e=1-Math.pow(1-t,3.2);
  V.yaw=lerp(c.y0,c.y1,e);V.pitch=lerp(c.p0,c.p1,e);setRot();
  if(t>=1){R.mode="free";CAST=null;startReading(c.k,c.s,true);R.once=(c.why==="cast");audio.bell(c.k,0.05);haptic.fire(14);emit("landed",{k:c.k+1,s:c.s,why:c.why});}
}
function rnd(n){const r=new Uint32Array(1);(window.crypto||{getRandomValues:a=>{a[0]=Math.random()*4294967295;return a;}}).getRandomValues(r);return r[0]%n;}
function cast(){
  const all=[];STANZAS.forEach((arr,k)=>arr.forEach((_,s)=>all.push([k,s])));
  const [k,s]=all[rnd(all.length)];flyTo(k,s,2+rnd(2),3.2,"cast");
}
{let shakes=[],lastCast=-1e9;window.addEventListener("devicemotion",e=>{const a=e.acceleration;if(!a||a.x==null||PAUSED)return;const m=Math.hypot(a.x,a.y,a.z),t=performance.now();
  if(m>14){shakes.push(t);shakes=shakes.filter(x=>t-x<800);if(shakes.length>=3&&t-lastCast>4500){lastCast=t;shakes=[];emit("shake",{});cast();}}});}
window.Globe={
  cast,
  goto(k,s){flyTo(k-1,s||0,0,1.3,"goto");},
  state(){return{mode:R.mode,k:R.cur?R.cur.k+1:(V.chap|0)+1,s:R.cur?R.cur.s:0,reading:!!(R.cur&&!R.cur.aborted),pressed:pressedN,total:N,cycle};},
  pause(){if(PAUSED)return;PAUSED=true;if(R.cur&&!R.cur.aborted)abortReading();audio.hush();audio.reading(false);audio.sleep(true);},
  resume(){if(!PAUSED)return;PAUSED=false;audio.sleep(false);if(frame.stopped){frame.stopped=false;frame.last=performance.now()/1000;requestAnimationFrame(frame);}V.settled=false;V.settledAt=simT;},
  set(o){if("sound" in o)audio.mute(!o.sound);if("haptics" in o)HAPTIC_ON=!!o.haptics;if("autoRead" in o)R.autoRead=!!o.autoRead;},
  unlock(){audio.ensure();haptic.arm();}
};
$("wit").addEventListener("click",()=>{const S=R.cur;if(S)emit("openChapter",{k:S.k+1,s:S.s,section:"editions"});});

// ---------- start ----------
canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();},false);
canvas.addEventListener("webglcontextrestored",()=>location.reload(),false);
document.addEventListener("visibilitychange",()=>{audio.sleep(document.hidden);if(!document.hidden)frame.last=performance.now()/1000;});
window.addEventListener("resize",resize);
load();
resize();
// open facing the passage you left off at
{const gi=STANZAS[R.posK][R.posS].a,s=slotOf[gi];V.yaw=-SPHI[s]+0.35;V.pitch=SLAT[s]+0.05;V.s=s;setRot();V.s=headFrom(V.yaw,V.pitch,s);V.q=Math.round(V.s);V.chap=gChap[gi];U.chapA=gChap[gi];}
const fontsReady=Promise.race([Promise.all([document.fonts.load(`700 40px "DDJ Serif"`,"道德經"),document.fonts.load(`700 40px "DDJ Serif"`,"分興虺蛇蜂蠆較"),document.fonts.load(`400 20px "Old Standard TT"`,"The Way")]).catch(()=>{}),new Promise(r=>setTimeout(r,2500))]);
fontsReady.then(()=>{buildAtlas();R.introAt=simT;requestAnimationFrame(frame);});
// for tests in a console: __DDJ.st() reads the state, __DDJ.ts(n) runs the clock n times faster
window.__DDJ={st:()=>({mode:R.mode,yaw:V.yaw,pitch:V.pitch,vy:V.vy,s:V.s,head:V.head,headCh:glyphs[V.head],chap:V.chap+1,settled:V.settled,held:R.held,info:INFO.gi,cur:R.cur&&{k:R.cur.k+1,s:R.cur.s,clock:+R.clock.toFixed(2),lifted:R.cur.lifted,landed:R.cur.landed,n:R.cur.n,aborted:R.cur.aborted},pressed:pressedN,cycle,stats:{...STATS},audio:audio.on,dim:+U.dim.toFixed(2),lens:+U.lens.toFixed(2),mag:VW.mag,charPx:VW.charPx,Rpx:VW.Rpx}),
  ts:x=>{TS=x;},still:x=>{R.stillDelay=x;},
  risen:()=>R.cur?R.cur.pos.map((q,j)=>q&&j>=R.cur.landed&&j<R.cur.lifted?{x:q.x,y:q.y,c:glyphs[R.cur.a+j]}:null).filter(Boolean):[],
  goto:(k,s)=>{if(R.cur&&!R.cur.aborted)abortReading();R.cur=null;R.mode="free";const gi=STANZAS[k-1][s||0].a,sl=slotOf[gi];V.yaw=-SPHI[sl];V.pitch=SLAT[sl];V.vy=V.vp=0;setRot();V.s=headFrom(V.yaw,V.pitch,sl);V.q=Math.round(V.s);V.detent=null;V.settled=false;U.intro=1;return window.__DDJ.st();},step:(sec,h)=>{h=h||1/60;for(let t=0;t<sec;t+=h)tick(h);setRot();return window.__DDJ.st();},screen:gi=>{glyphScreen(gi,tmp);return{...tmp};},slotOf:gi=>slotOf[gi],stanza:(k,s)=>STANZAS[k-1][s],raiseAll,pressAll:()=>{for(let i=0;i<N;i++)pressGlyph(i);}};
})();
