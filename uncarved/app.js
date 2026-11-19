(function(){
"use strict";
const D=window.DDJ,$=id=>document.getElementById(id);
const C=()=>window.DDJ_COMM||{intro:[],ch:{},edition:{edits:[],not_followed:[],sources:{}}};
const HAN=/[㐀-鿿\u{20000}-\u{2ffff}]/u;
const D10="〇一二三四五六七八九",cn=n=>n<10?D10[n]:n<20?"十"+(n%10?D10[n%10]:""):D10[Math.floor(n/10)]+"十"+(n%10?D10[n%10]:"");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const zhWrap=s=>esc(s).replace(/([㐀-鿿\u{20000}-\u{2ffff}□﹦][㐀-鿿\u{20000}-\u{2ffff}□﹦，。；：？！、「」]*)/gu,'<span class="zhi">$1</span>');
const NCH=81,G=window.Globe||{};

// ---------- settings ----------
const SKEY="uncarved-settings";
const S=Object.assign({sound:true,haptics:true,autoRead:true,pinyin:true,size:1},JSON.parse(localStorage.getItem(SKEY)||"{}"));
const saveS=()=>{localStorage.setItem(SKEY,JSON.stringify(S));apply();};
function apply(){if(G.set)G.set({sound:S.sound,haptics:S.haptics,autoRead:S.autoRead});document.documentElement.style.setProperty("--fs",S.size);}
apply();

// ---------- the text, cut into passages as the globe cuts it ----------
const glyphsOf=k=>[...D.DATA.ch[k][1]].filter(c=>HAN.test(c));
function passages(k){
  const txt=D.DATA.ch[k][1],g=glyphsOf(k),an=D.ANCHORS[k+1]||[],cuts=[0];
  for(const a of an){const i=g.join("").indexOf(a,cuts[cuts.length-1]+1);cuts.push(i>0?i:cuts[cuts.length-1]+1);}
  cuts.push(g.length);
  // split the punctuated text at the same glyph boundaries
  const parts=[];let gi=0,cur="",ci=1;
  for(const ch of txt){
    if(HAN.test(ch)){if(gi===cuts[ci]){parts.push(cur);cur="";ci++;}gi++;}
    cur+=ch;
  }
  parts.push(cur);
  const en=D.DATA.en[k].split("\n\n");
  return parts.map((zh,s)=>({zh,en:en[s]||"",a:cuts[s],b:cuts[s+1]}));
}
const firstLine=k=>{const t=D.DATA.ch[k][1];const m=t.match(/^[^，。；：？！]+/);return m?m[0]:t.slice(0,8);};

// ---------- panels and the back button ----------
const stack=[];
function cover(on){document.body.classList.toggle("covered",on);if(on){G.pause&&G.pause();}else{G.resume&&G.resume();}}
function openPanel(id,render){
  const el=$(id);if(render)render();
  el.classList.add("open");el.setAttribute("aria-hidden","false");
  if(!stack.includes(id)){stack.push(id);history.pushState({p:id},"");}
  if(id==="sheet")cover(true);
  hideCard();
}
function closeTop(fromPop){
  const id=stack.pop();if(!id)return false;
  const el=$(id);el.classList.remove("open");el.setAttribute("aria-hidden","true");
  if(id==="sheet")cover(false);
  hideGloss();
  if(!fromPop)history.back();
  return true;
}
window.addEventListener("popstate",()=>{if(stack.length)closeTop(true);});
window.__back=()=>{if($("gloss").classList.contains("on")){hideGloss();return true;}if(stack.length){closeTop(false);return true;}return false;};
$("lib").querySelector(".scrim").addEventListener("click",()=>closeTop(false));

// ---------- the library ----------
function renderLib(){
  const st=G.state?G.state():{pressed:0,total:5286,k:1};
  const pct=Math.round(100*st.pressed/st.total);
  let h=`<div class="brand"><i class="seal">樸</i><div><b>UNCARVED</b><span>道德經 · TAO TE CHING</span></div></div>
  <div class="nav">
    <button data-go="intro"><b>How to hold it</b><i>用</i></button>
    <button data-go="ask"><b>Ask the Way</b><i>問</i></button>
    <button data-go="book"><b>The book and this edition</b><i>經</i></button>
    <button data-go="settings"><b>Settings</b><i>設</i></button>
  </div>
  <div class="prog"><small>${st.pressed?`${st.pressed.toLocaleString()} of ${st.total.toLocaleString()} characters read into the stone`:"Nothing read into the stone yet"}</small><div class="bar"><i style="width:${pct}%"></i></div></div>
  <div class="label">The eighty-one chapters</div><div class="chlist">`;
  for(let k=0;k<NCH;k++){const [zh,en]=D.TITLES[k];
    h+=`<button data-ch="${k+1}" class="${st.k===k+1?"here":""}"><span class="n">${k+1}</span><span class="zh">${esc(zh)}</span><span class="en">${esc(en)}</span><span class="l">${esc(firstLine(k))}</span></button>`;}
  h+="</div>";
  const p=$("lib").querySelector(".panel");p.innerHTML=h;
  const here=p.querySelector(".here");if(here)setTimeout(()=>here.scrollIntoView({block:"center"}),60);
}
$("lib").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.ch){const k=+b.dataset.ch;closeTop(false);setTimeout(()=>openChapter(k),80);return;}
  const go=b.dataset.go;closeTop(false);
  setTimeout(()=>{if(go==="ask")ask();else openPage(go);},80);
});
$("bLib").addEventListener("click",()=>{G.unlock&&G.unlock();openPanel("lib",renderLib);});
$("bAsk").addEventListener("click",()=>{G.unlock&&G.unlock();ask();});

// ---------- a chapter ----------
let curK=1;
function openChapter(k,section){
  curK=k;openPanel("sheet",()=>renderChapter(k));
  const sh=$("sheet").querySelector(".sheetIn");
  setTimeout(()=>{if(section){const el=sh.querySelector("#sec-"+section);if(el)el.scrollIntoView({behavior:"smooth"});}else sh.scrollTop=0;},section?420:0);
}
function chapterHTML(k){
  const i=k-1,[zh,en]=D.TITLES[i],cm=C().ch[k]||{};
  const ps=passages(i),py=D.PY[i];
  let h=`<div class="hdr"><button data-x="close" aria-label="Close">✕</button><span class="mid">第${cn(k)}章</span><span><button data-x="prev" aria-label="Previous chapter">‹</button><button data-x="next" aria-label="Next chapter">›</button></span></div><div class="page">
  <div class="hero"><div class="num">${k}</div><div class="zh">${esc(zh)}</div><div class="en">${esc(en)}</div></div>`;
  if(cm.lead)h+=`<p class="lead">${zhWrap(cm.lead)}</p>`;
  h+=`<div class="acts"><button class="pill red" data-x="globe">Read it on the stone</button><button class="pill" data-x="share">Share</button></div>`;
  ps.forEach((p,s)=>{
    let gi=p.a,z="";
    for(const c of p.zh){if(HAN.test(c)){const r=S.pinyin?`<rt>${esc(py[gi]||"")}</rt>`:"";z+=`<ruby class="c" data-g="${gi}">${c}${r}</ruby>`;gi++;}else if(c.trim())z+=`<span class="p">${esc(c)}</span>`;}
    h+=`<div class="pass" id="p-${s}"><div class="zh">${z}</div><div class="en">${esc(p.en).replace(/\n/g,"<br>")}</div></div>`;
  });
  // the other editions
  let ed="";
  ps.forEach((p,s)=>{const rows=D.WIT[k+"."+s];if(!rows)return;
    ed+=`<div class="blk"><div class="wr"><span>Wang Bi</span><span class="t" style="color:var(--bone)">${esc(p.zh.replace(/[，。；：？！、「」（）]/g,""))}</span></div>`;
    for(const [e,t,m,o] of rows){const om=new Set(o);let z="";[...t].forEach((c,j)=>{if(om.has(j))z+="<u>·</u>";z+=c==="□"?"<i>□</i>":m[j]==="1"?"<b>"+esc(c)+"</b>":esc(c);});
      ed+=`<div class="wr"><span>${D.WED[e]}</span><span class="t">${z}</span></div>`;}
    const nt=D.WNOTE[k+"."+s];if(nt)ed+=`<div class="nt">${esc(nt)}</div>`;
    ed+="</div>";});
  h+=`<h3 class="sec" id="sec-editions">Other editions</h3><div class="eds">${ed||'<p class="note" style="text-align:center">Every edition reads these lines the same way.</p>'}<p class="note">Red: where an edition reads differently from Wang Bi. □: lost from the silk. A red dot: a word Wang Bi has that this edition lacks.</p></div>`;
  // the commentary
  if(cm.ex){
    const para=a=>(a||[]).map(x=>`<p>${zhWrap(x)}</p>`).join("");
    h+=`<h3 class="sec" id="sec-comm">Commentary</h3><div class="comm"><h4>What the characters say</h4>${para(cm.ex)}<h4>How it is built</h4>${para(cm.an)}<h4>What is at stake</h4>${para(cm.di)}</div>`;
  }
  // the key words in this chapter
  const seen=new Set(),kw=[];for(const c of glyphsOf(i)){if(D.KEY[c]&&!seen.has(c)){seen.add(c);kw.push(c);}}
  if(kw.length){h+=`<h3 class="sec">Key words</h3><div class="kw">`+kw.map(c=>`<div><b>${c}</b><em>${esc(D.KEY[c].en)}</em><p>${zhWrap(D.KEY[c].note)}</p></div>`).join("")+`</div>`;}
  const pk=k>1?k-1:81,nk=k<81?k+1:1;
  h+=`<div class="navch"><button data-x="prev"><small>‹ ${pk}</small><b>${esc(D.TITLES[pk-1][0])}</b></button><button data-x="next"><small>${nk} ›</small><b>${esc(D.TITLES[nk-1][0])}</b></button></div>
  <p class="note" style="text-align:center;margin-top:30px">Wang Bi’s text · English translation and commentary made with Claude · <a href="#" data-x="book" style="color:var(--muted)">about this edition</a></p></div>`;
  return h;
}
function renderChapter(k){const sh=$("sheet").querySelector(".sheetIn");sh.innerHTML=chapterHTML(k);sh.setAttribute("aria-label","Chapter "+k);}
$("sheet").addEventListener("click",e=>{
  const c=e.target.closest(".c");if(c){showGloss(+c.dataset.g,c);return;}
  const b=e.target.closest("[data-x]");if(!b){hideGloss();return;}
  e.preventDefault();const x=b.dataset.x;
  if(x==="close")closeTop(false);
  else if(x==="prev"||x==="next"){curK=x==="prev"?(curK>1?curK-1:81):(curK<81?curK+1:1);renderChapter(curK);$("sheet").querySelector(".sheetIn").scrollTop=0;}
  else if(x==="globe"){const k=curK;closeTop(false);setTimeout(()=>{G.goto&&G.goto(k,0);},350);}
  else if(x==="share")shareCard(curK,0);
  else if(x==="book"){renderPage("book");$("sheet").querySelector(".sheetIn").scrollTop=0;}
  else if(x==="intro"||x==="settings"){renderPage(x);}
});

// ---------- one character, from a chapter page ----------
const PYT={"ā":1,"ē":1,"ī":1,"ō":1,"ū":1,"ǖ":1,"á":2,"é":2,"í":2,"ó":2,"ú":2,"ǘ":2,"ǎ":3,"ě":3,"ǐ":3,"ǒ":3,"ǔ":3,"ǚ":3,"à":4,"è":4,"ì":4,"ò":4,"ù":4,"ǜ":4};
let COUNT=null;
function showGloss(gi,el){
  const k=curK-1,g=glyphsOf(k),c=g[gi],py=D.PY[k][gi]||"",key=D.KEY[c];
  if(!COUNT){COUNT=new Map();for(let i=0;i<81;i++)for(const x of glyphsOf(i))COUNT.set(x,(COUNT.get(x)||0)+1);}
  const G2=D.GLOSS[c]||[];const tn=[...py].map(x=>PYT[x]).find(Boolean)||5;
  const e=G2.find(r=>[...r[0]].map(x=>PYT[x]).find(Boolean)===tn)||G2[0]||["",0,""];
  const n=COUNT.get(c)||1;
  const gl=$("gloss");
  gl.innerHTML=`<div class="big">${c}</div><div class="tx"><div class="py">${esc(py)}${key?`<i>${esc(key.en)}</i>`:""}</div><div class="gl">${esc(key?key.note:senses(e[2]))}</div><div class="ct">${n===1?"once":n+" times"} in the book · meanings from CC-CEDICT</div></div>`;
  gl.classList.add("on");
  document.querySelectorAll(".c.sel").forEach(x=>x.classList.remove("sel"));el.classList.add("sel");
}
const senses=t=>{const a=(t||"").split("; ").filter(x=>!/^(surname|short name|abbr|old variant|variant of|CL:|used in|see )/i.test(x));return (a.length?a:(t||"").split("; ")).slice(0,4).join("; ");};
function hideGloss(){$("gloss").classList.remove("on");document.querySelectorAll(".c.sel").forEach(x=>x.classList.remove("sel"));}
$("gloss").addEventListener("click",hideGloss);

// ---------- pages: how to hold it, the book, settings ----------
function openPage(p){openPanel("sheet",()=>renderPage(p));}
function renderPage(p){
  const sh=$("sheet").querySelector(".sheetIn");let h=`<div class="hdr"><button data-x="close" aria-label="Close">✕</button><span class="mid">${{intro:"用",book:"經",settings:"設"}[p]}</span><span style="width:44px"></span></div><div class="page prose">`;
  if(p==="intro"){
    h+=`<h2>How to hold it</h2><p>The whole of the Tao Te Ching is carved on this stone: 81 chapters, 5,286 characters, one spiral groove from the north pole to the south. Nothing on it needs explaining before you touch it.</p>
    <div class="gest">
      <div><b>轉</b><span><em>Turn it</em>Every character that passes the middle is plucked in its own Mandarin tone. Flick it hard and it runs like a zither.</span></div>
      <div><b>靜</b><span><em>Let go</em>When it comes to rest, the passage under the lens rises and is read: Chinese, sung, then English.</span></div>
      <div><b>觸</b><span><em>Touch a character</em>Its sound and meaning. Touch the stone and a ripple runs through the text.</span></div>
      <div><b>聚</b><span><em>Hold it</em>Press and hold. The characters gather round your finger like iron filings. Drag them. Let go and they fall back into place.</span></div>
      <div><b>問</b><span><em>Ask the Way</em>Hold a question in mind, then shake the phone or press 問. The stone spins and lands on a passage. People have read this book that way for two thousand years.</span></div>
      <div><b>章</b><span><em>Open a chapter</em>Touch the chapter’s name while it reads, or open the library with 樸: the text with pinyin, the oldest manuscripts beside it, and a commentary on every chapter.</span></div>
    </div>`;
  }else if(p==="book"){
    const cm=C();
    h+=`<h2>The book</h2><p>The <i>Laozi</i>, also called the <i>Tao Te Ching</i> (道德經, “the classic of the Way and its virtue”), is a book of about five thousand characters from China’s Warring States period. Its oldest surviving copy, on bamboo slips, was buried around 300 BCE. It is credited to Laozi, “the old master”, about whom nothing certain is known. It has been read as philosophy, as a manual for rulers, as instruction for the body, and as scripture. It is the most translated book in Chinese.</p>
    <h4>The text on the stone</h4><p>Wang Bi’s text (王弼本), as printed in the Ming Daoist canon of 1445 (Daozang, DZ 690), from the Kanseki Repository’s digital edition. Wang Bi (226–249) wrote the commentary through which the book was read for most of its history, and his text is what scholars call the received text. ${cm.edition.edits.length} places differ from the first version of this globe; ten copying errors in the Daozang print are corrected; every one is listed below. Characters are given in standard traditional forms.</p>
    <h4>The other editions</h4><p>Beside each passage: Heshang Gong’s text (Han, by tradition; checked against the Song print in the Sibu congkan), Fu Yi’s “ancient text” (Tang), and the two silk manuscripts from Mawangdui, buried in 168 BCE, transcribed letter for letter. The Guodian slips are not yet included, because no reliable digital transcription exists.</p>
    <h4>The English and the commentary</h4>${(cm.intro||[]).map(x=>`<p>${zhWrap(x)}</p>`).join("")}
    <h4>Sound, meanings, type</h4><p>Readings in context from pinyin-pro, with tones checked by hand. Meanings from CC-CEDICT (CC BY-SA 4.0). Characters set in Noto Serif CJK TC and Noto Serif TC (SIL Open Font License); English in Old Standard TT and Cormorant Garamond.</p>
    <h4>Every change to the Chinese</h4><table class="chg">${cm.edition.edits.map(e=>`<tr><td>${e.ch}</td><td class="zhi">${esc(e.old)}</td><td class="zhi">${esc(e.new)}</td><td>${esc(e.note||e.kind)}</td></tr>`).join("")}</table>
    <h4>Daozang copying errors not followed</h4><table class="chg">${cm.edition.not_followed.map(e=>`<tr><td>${e.ch}</td><td class="zhi">${esc(e.keep)}</td><td class="zhi">${esc(e.daozang.replace("DZ ",""))}</td><td>${esc(e.why)}</td></tr>`).join("")}</table>
    <p class="note">Data, sources with exact versions, and downloads: superdenis777.github.io/dao-de-qiu/about.html</p>`;
  }else if(p==="settings"){
    const sw=(k,t,sub)=>`<label>${t}${sub?`<small>${sub}</small>`:""}<input class="sw" type="checkbox" data-s="${k}" ${S[k]?"checked":""}></label>`;
    h+=`<h2>Settings</h2><div class="set">${sw("sound","Sound","the voice, the strings, the bowl")}${sw("haptics","Vibration","a tick under the finger")}${sw("autoRead","Read when still","the passage under the lens rises when the stone rests")}${sw("pinyin","Pinyin in chapters","the reading above each character")}
    <label>Text size<span class="seg">${[[.9,"S"],[1,"M"],[1.15,"L"]].map(([v,t])=>`<button data-size="${v}" class="${S.size==v?"on":""}">${t}</button>`).join("")}</span></label></div>
    <p class="note" style="margin-top:24px">Your place and what you have read are kept on this device only. Nothing is collected or sent anywhere.</p>`;
  }
  h+="</div>";sh.innerHTML=h;
}
$("sheet").addEventListener("change",e=>{const i=e.target.closest("[data-s]");if(!i)return;S[i.dataset.s]=i.checked;saveS();});
$("sheet").addEventListener("click",e=>{const b=e.target.closest("[data-size]");if(!b)return;S.size=+b.dataset.size;saveS();renderPage("settings");});

// ---------- ask the Way ----------
let asked=null;
function ask(){hideCard();toast("Hold your question.");G.cast&&G.cast();}
window.addEventListener("globe:landed",e=>{if(e.detail.why==="cast")asked=e.detail;});
window.addEventListener("globe:passageEnd",e=>{const d=e.detail;if(d.once&&asked&&asked.k===d.k&&asked.s===d.s)showCard(d.k,d.s);});
window.addEventListener("globe:openChapter",e=>openChapter(e.detail.k,e.detail.section));
window.addEventListener("globe:shake",()=>toast("You asked the Way."));
function showCard(k,s){
  const o=$("oracle"),[zh,en]=D.TITLES[k-1];
  o.innerHTML=`<div class="k">第${cn(k)}章 · ${esc(zh)}</div><div class="t">${esc(en)}</div><div class="row"><button class="pill red" data-o="read">Read the chapter</button><button class="pill" data-o="share">Share</button><button class="pill" data-o="again">Ask again</button></div>`;
  o.dataset.k=k;o.dataset.s=s;o.classList.add("on");
}
function hideCard(){$("oracle").classList.remove("on");}
$("oracle").addEventListener("click",e=>{const b=e.target.closest("[data-o]");if(!b)return;const o=$("oracle"),k=+o.dataset.k,s=+o.dataset.s;
  if(b.dataset.o==="read"){hideCard();openChapter(k);}else if(b.dataset.o==="share")shareCard(k,s);else{hideCard();ask();}});
let tT=0;function toast(t){let el=document.querySelector(".toast");if(!el){el=document.createElement("div");el.className="toast";document.body.appendChild(el);}el.textContent=t;el.classList.add("on");clearTimeout(tT);tT=setTimeout(()=>el.classList.remove("on"),2200);}

// ---------- a card to share ----------
function wrapZh(x,txt,maxW){const out=[];let line="";for(const c of txt){const t=line+c;if(x.measureText(t).width>maxW&&line){if(/[，。；：？！、」]/.test(c)){out.push(t);line="";continue;}out.push(line);line=c;}else line=t;}if(line)out.push(line);return out;}
function wrapEn(x,txt,maxW){const out=[];for(const para of txt.split("\n")){let line="";for(const w of para.split(" ")){const t=line?line+" "+w:w;if(x.measureText(t).width>maxW&&line){out.push(line);line=w;}else line=t;}out.push(line);}return out;}
async function shareCard(k,s){
  const p=passages(k-1)[s]||passages(k-1)[0],[zh,en]=D.TITLES[k-1];
  try{await Promise.all([document.fonts.load('700 60px "UI Serif TC"',p.zh),document.fonts.load('italic 400 40px "Cormorant"'),document.fonts.load('400 30px "Old Standard TT"')]);}catch(e){}
  const W=1080,H=1350,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const g=x.createRadialGradient(W*0.5,H*0.42,80,W*0.5,H*0.5,H*0.8);g.addColorStop(0,"#15140f");g.addColorStop(1,"#050506");x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle="#b3321e";x.fillRect(84,84,64,64);x.fillStyle="#f6ecd6";x.font='700 42px "UI Serif TC","Noto Serif TC",serif';x.textAlign="center";x.textBaseline="middle";x.fillText("樸",116,118);
  x.textAlign="left";x.fillStyle="#8a8274";x.font='500 26px "Cormorant",Georgia,serif';x.fillText("第"+cn(k)+"章 · "+zh+"  ·  "+en,170,116);
  let fs=66,ef=40,zl,el;const fit=()=>{x.font=`700 ${fs}px "UI Serif TC","Noto Serif TC",serif`;zl=wrapZh(x,p.zh,W-200);x.font=`italic 400 ${ef}px "Cormorant",Georgia,serif`;el=wrapEn(x,p.en,W-220);return 250+zl.length*fs*1.55+90+el.length*ef*1.4;};
  while(fit()>H-160&&(fs>38||ef>24)){if(fs>38)fs-=3;if(ef>24)ef-=2;}
  if(fit()>H-160){const room=Math.floor((H-160-250-zl.length*fs*1.55-90)/(ef*1.4));el=el.slice(0,Math.max(1,room-1));el[el.length-1]+=" …";}
  let y=250+fs*0.5;x.font=`700 ${fs}px "UI Serif TC","Noto Serif TC",serif`;x.fillStyle="#ece2cc";x.textAlign="center";for(const l of zl){x.fillText(l,W/2,y);y+=fs*1.55;}
  y+=20;x.fillStyle="rgba(239,106,76,.6)";x.fillRect(W/2-24,y,48,2);y+=60;
  x.font=`italic 400 ${ef}px "Cormorant",Georgia,serif`;x.fillStyle="#d4cab4";for(const l of el){x.fillText(l,W/2,y);y+=ef*1.4;}
  x.fillStyle="#6c665c";x.font='300 30px "Cormorant",Georgia,serif';x.fillText("U N C A R V E D   ·   Tao Te Ching",W/2,H-96);
  const url=cv.toDataURL("image/png"),text=`Tao Te Ching, chapter ${k}: ${en}`;
  if(window.NativeBridge&&window.NativeBridge.shareImage){window.NativeBridge.shareImage(url,text);return;}
  try{const blob=await (await fetch(url)).blob(),file=new File([blob],`tao-te-ching-${k}.png`,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return;}}catch(e){if(e&&e.name==="AbortError")return;}
  const a=document.createElement("a");a.href=url;a.download=`tao-te-ching-${k}.png`;document.body.appendChild(a);a.click();a.remove();
}

// ---------- first hints ----------
const FKEY="uncarved-hints";let hints=+(localStorage.getItem(FKEY)||0);
window.addEventListener("globe:passageEnd",()=>{if(hints<1){hints=1;localStorage.setItem(FKEY,"1");setTimeout(()=>toast("Hold the stone to gather the characters."),600);}else if(hints<2){hints=2;localStorage.setItem(FKEY,"2");$("bAsk").classList.add("pulse");setTimeout(()=>toast("Shake, or press 問, to ask the Way."),600);}});
window.addEventListener("globe:gather",()=>{if(hints<1){hints=1;localStorage.setItem(FKEY,"1");}});
// the native shell asks for the safe areas it cannot give CSS
window.__insets=(t,b)=>{document.documentElement.style.setProperty("--sat",t+"px");document.documentElement.style.setProperty("--sab",b+"px");};
})();
if("serviceWorker" in navigator&&location.protocol==="https:"&&!window.NativeBridge){navigator.serviceWorker.register("sw.js").catch(()=>{});}
