import {useEffect,useMemo,useRef,useState,lazy,Suspense} from 'react';
import {beyStats,BAR_LABEL,BAR_COLOR} from '../game/stats.js';
import {TIPS} from '../physics/model.js';
import {BeySvg} from '../ui/BeyArt.jsx';
import {TYPE_LABEL} from '../game/beys.js';
import * as sfx from '../game/sfx.js';
import KnowledgeCard from '../knowledge/KnowledgeCard.jsx';
import {lookWords} from '../scene/look.js';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

// Fusion candidates as rare trading cards: 3D fused bey with type aura, holo sheen, manga name,
// 必杀技 banner, stat radar, compact why/tradeoff, knowledge icons. Reveal + "GET!" pick sequence.
const TYPE_C={attack:'#ff2d4a',defense:'#f2b632',stamina:'#14c9a5',balance:'#8a3cff'};
const MOVE_SUFFIX={attack:'突击',defense:'铁壁',stamina:'永动旋风',balance:'风暴'};
const KICON={physics:'🔬',design:'🎮',official:'🏆',world:'🌍',geo:'🌍'};

function moveOf(bey){
  if(bey.specialMove?.name)return {name:bey.specialMove.name,shout:bey.specialMove.shout};
  const base=(bey.zh||bey.name||'').replace(/[·\s].*$/,'').slice(0,3);
  return {name:`${base}${MOVE_SUFFIX[bey.type]||'旋风'}`,shout:null};
}

function Radar({bars}){
  const keys=Object.keys(BAR_LABEL),R=38,c=48;
  const pt=(k,i,v)=>{const a=-Math.PI/2+i*2*Math.PI/keys.length;return [c+Math.cos(a)*R*v,c+Math.sin(a)*R*v];};
  const poly=keys.map((k,i)=>pt(k,i,Math.max(.06,(bars[k]||0)/100)).join(',')).join(' ');
  return (
    <svg className="hc-radar" viewBox="-14 -6 124 108">
      {[1,.66,.33].map(f=><polygon key={f} points={keys.map((k,i)=>pt(k,i,f).join(',')).join(' ')} fill="none" stroke="#111" strokeOpacity=".25" strokeWidth="1"/>)}
      {keys.map((k,i)=>{const [x,y]=pt(k,i,1);return <line key={k} x1={c} y1={c} x2={x} y2={y} stroke="#111" strokeOpacity=".2"/>;})}
      <polygon className="hc-radar-poly" points={poly} fill="rgba(255,212,0,.55)" stroke="#111" strokeWidth="2" strokeLinejoin="round"/>
      {keys.map((k,i)=>{const [x,y]=pt(k,i,1.22);return <text key={k} x={x} y={y+3} textAnchor="middle" fontSize="9" fontWeight="900" fill={BAR_COLOR[k]}>{BAR_LABEL[k]}{bars[k]}</text>;})}
    </svg>
  );
}

function Hero3D({bey,delay}){
  const rpmRef=useRef(0);
  const [on,setOn]=useState(false); // mount after the flip-in so the 3D view measures its final size
  useEffect(()=>{const t=setTimeout(()=>setOn(true),delay);return()=>clearTimeout(t);},[delay]);
  useEffect(()=>{let raf,t0;const t=setTimeout(()=>{t0=performance.now();const f=()=>{const k=Math.min(1,(performance.now()-t0)/1400);rpmRef.current=5200*(1-Math.pow(1-k,3));if(k<1)raf=requestAnimationFrame(f);};f();},delay);return()=>{clearTimeout(t);cancelAnimationFrame(raf);};},[delay]);
  if(!on)return null;
  return <Suspense fallback={null}><BeyShowcase bey={bey} rpmRef={rpmRef} tilt={.5} zoom={1.02} background={false}/></Suspense>;
}

export function HeroCard({bey,i=0,revealDelay=0,onPick,picking,kOpen=null,setKOpen=()=>{}}){
  const st=useMemo(()=>beyStats(bey),[bey]);
  const mv=moveOf(bey), tc=TYPE_C[bey.type]||'#888';
  const ks=(bey.knowledge||[]).filter(Boolean);
  const [tilt,setTilt]=useState({x:0,y:0,h:50});
  const flipped=!!kOpen;
  const [show3d,setShow3d]=useState(true); // hide the 3D bey while the back is showing (it lives on the front)
  useEffect(()=>{if(flipped){const t=setTimeout(()=>setShow3d(false),220);return()=>clearTimeout(t);}setShow3d(true);},[flipped]);
  const onMove=e=>{if(flipped)return;const r=e.currentTarget.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;setTilt({x:(y-.5)*-8,y:(x-.5)*10,h:x*100});};
  const sel=kOpen&&ks.find(k=>k.id===kOpen.id)||ks[0];
  return (
    <div className={`hc ${picking?'picked':''} ${flipped?'flipped':''}`} style={{'--tc':tc,'--d':`${revealDelay}ms`,'--hx':`${tilt.h}%`,transform:`perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`}}
      onPointerMove={onMove} onPointerLeave={()=>setTilt({x:0,y:0,h:50})}>
      <div className="hc-flip">
      <div className="hc-inner hc-front" aria-hidden={flipped}>
        <div className="hc-holo"/>
        <div className="hc-head">
          <span className="hc-type">{TYPE_LABEL[bey.type]||bey.type}</span>
          {bey.fusedBy==='template'&&<span className="hc-tag">公式方案</span>}
          <span className="hc-no">No.{String(i+1).padStart(3,'0')}</span>
        </div>
        <div className="hc-art"><span className="hc-aura"/>{show3d&&<Hero3D bey={bey} delay={revealDelay+620}/>}</div>
        <div className="hc-name"><b>{bey.name}</b><small>{bey.zh}</small></div>
        {bey.look&&<div className="hc-look">✨ {lookWords(bey.look)}</div>}
        <div className="hc-move"><span>必杀技</span><b>{mv.name}</b>{mv.shout&&<em>「{mv.shout}」</em>}</div>
        <div className="hc-mid">
          <Radar bars={st.bars}/>
          <div className="hc-facts">
            <div><small>重量</small><b>{st.massG}</b> g</div>
            <div><small>转动惯量</small><b>{st.inertia}</b><em>×10⁻⁶</em></div>
            <div><small>零件</small><b>{bey.ratchet?.prongs||3}-{bey.ratchet?.height||60}</b> {TIPS[bey.bit]?.label?.split(' ')[0]||bey.bit}</div>
          </div>
        </div>
        {bey.why&&<p className="hc-why" title={bey.why}><b>💡</b>{bey.why}</p>}
        {bey.tradeoff&&<p className="hc-trade" title={bey.tradeoff}><b>⚖️</b>{bey.tradeoff}</p>}
        {ks.length>0&&<div className="hc-krow"><span className="hc-krow-l">📓 知识点</span>{ks.slice(0,3).map(k=><button key={k.id} type="button" className="hc-chip" onClick={e=>{e.stopPropagation();setKOpen(k);}}>{KICON[k.layer]||'📚'} {k.title}</button>)}</div>}
        <div className="hc-foot"><button className="hc-pick" onClick={()=>onPick(bey)} disabled={!!picking||flipped}>就选它！</button></div>
      </div>
      <div className="hc-inner hc-back" aria-hidden={!flipped}>
        <div className="hc-back-h"><img src="/art/doctor/thinking.png" alt="" onError={e=>{e.currentTarget.style.display='none';}}/><div><b>博士的科学笔记</b><small>{bey.name} 用到的知识</small></div></div>
        {ks.length>1&&<div className="hc-tabs">{ks.map(k=><button key={k.id} type="button" className={sel?.id===k.id?'on':''} onClick={e=>{e.stopPropagation();setKOpen(k);}}>{KICON[k.layer]||'📚'} {k.title}</button>)}</div>}
        <div className="hc-note">{sel&&<KnowledgeCard key={sel.id} card={sel}/>}
          {bey.why&&<div className="hc-note-why"><b>放在这个方案里：</b>{bey.why}</div>}
        </div>
        <button type="button" className="hc-back-btn" onClick={e=>{e.stopPropagation();setKOpen(null);}}>↩ 翻回来</button>
      </div>
      </div>
    </div>
  );
}

/** Candidate zone: plays the 合体 reveal once per new candidate set, then hero cards; picking zooms + GET!. */
export default function HeroCards({candidates,parents,onPick,introImg=null}){
  const sig=candidates.map(c=>c.id).join(',');
  const [intro,setIntro]=useState(true);
  const [chosen,setChosen]=useState(null);
  const [kOpen,setKOpen]=useState(null); // {card:index, k} — only one knowledge card open at a time
  useEffect(()=>{
    if(!kOpen)return;
    const close=e=>{if(!e.target.closest?.('.hc-back,.hc-chip'))setKOpen(null);};
    const esc=e=>{if(e.key==='Escape')setKOpen(null);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',esc);};
  },[kOpen]);
  useEffect(()=>{
    setIntro(true);setChosen(null);sfx.whoosh();
    const ts=[setTimeout(()=>sfx.clang(.9),650),setTimeout(()=>setIntro(false),1150)];
    candidates.forEach((_,i)=>ts.push(setTimeout(()=>sfx.clang(.45),1250+i*260)));
    return()=>ts.forEach(clearTimeout);
  },[sig]);// eslint-disable-line
  const pick=b=>{setChosen(b);sfx.clang(1);sfx.fanfare?.(true);setTimeout(()=>onPick(b),1500);};
  return (
    <div className="hc-zone">
      {intro&&!(parents?.length===2)&&<div className="hc-intro">
        {introImg?<img className="hc-intro-img" src={introImg} alt=""/>:<div className="hc-intro-img q">?</div>}
        <div className="hc-intro-spark"/>
        <div className="hc-intro-txt">变身！</div>
      </div>}
      {intro&&parents?.length===2&&<div className="hc-intro">
        <div className="hc-intro-l"><BeySvg bey={parents[0]} size={130} spin/></div>
        <div className="hc-intro-r"><BeySvg bey={parents[1]} size={130} spin/></div>
        <div className="hc-intro-spark"/>
        <div className="hc-intro-txt">合体！</div>
      </div>}
      {!intro&&!chosen&&<div className="hc-grid" style={{'--n':candidates.length}}>{candidates.map((c,i)=><HeroCard key={c.id||i} bey={c} i={i} revealDelay={i*260} onPick={b=>{setKOpen(null);pick(b);}} picking={chosen}
        kOpen={kOpen?.card===i?kOpen.k:null} setKOpen={k=>setKOpen(k?{card:i,k}:null)}/>)}</div>}
      {chosen&&<div className="hc-get"><div className="hc-get-card"><HeroCard bey={chosen} i={candidates.indexOf(chosen)} onPick={()=>{}} picking/></div><div className="hc-get-stamp">GET!</div></div>}
    </div>
  );
}
