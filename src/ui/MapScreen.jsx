import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useGame,bladerById} from '../game/store.js';
import {BLADERS,TIERS,tierUnlocked} from '../game/story.js';
import {TypeBadge} from './common.jsx';
import BeyArt from './BeyArt.jsx';
import './map.css';

// Illustrated world map: the ink-wash map IS the page. Bladers and places are hotspots on the
// landscape; tapping one zooms the camera in and page-flips into a full comic page.

function hint(save){
  if(!save.defeated.length)return '先去村子里挑战普通对手吧！打赢能赚金币。';
  if(save.collection.length<3){
    if(save.coins>=100)return `你有 ${save.coins} 金币，可以去商店开盲盒；或者来融合工坊，让我帮你设计一只新陀螺！`;
    return `再有 ${3-save.collection.length} 只陀螺，山那边的雾就会散开——职业对手在等你！试试融合工坊？`;
  }
  if(save.team.length<3)return '打败职业对手，就能邀请他们加入你的队伍！';
  if(!tierUnlocked('boss',save))return '超级职业已经解锁，他们可不好对付……先预测再出手！';
  return '龙王在城堡里等你。准备好你最强的陀螺吧！';
}

// Hotspot positions in % of the 1920×1080 map art.
const SPOTS={
  ran:[6.5,58], tetsu:[10,74], hop:[20,71],          // village & harbour (foreground)
  raiga:[5.5,15], hyomi:[23,12], iwaki:[8,39],         // torii island, rock island, west cliffs
  shadow:[93.5,55], blaze:[84,41], nova:[72,9],        // mountain gate, east cliffs, snowy peak
  ryuoh:[91,14],                                       // dragon castle
};
const TIER_FOG={pro:[[5.5,15],[23,12],[8,39],[14,26]],super:[[93.5,55],[84,41],[72,9],[88,30]],boss:[[91,14],[86,8]]};
const LOCK_AT={pro:[15,27],super:[86,50],boss:[90,23]};
const PLACES=[
  {id:'shop',label:'盲盒商店',img:'/art/bg/shop.jpg',crop:'3% 42% / auto 240%',at:[38,64],go:'shop'},
  {id:'fusion',label:'AI 融合工坊',img:'/art/bg/lab.jpg',crop:'4% 60% / auto 210%',at:[50,68],go:'fusion',doctor:true},
  {id:'versus',label:'对战道场',img:'/art/bg/arena.jpg',crop:'100% 52% / auto 250%',at:[62,64],go:'versus'},
  {id:'codex',label:'知识图鉴',icon:'scroll',at:[60,87],go:'codex'},
  {id:'collection',label:'我的陀螺',icon:'bag',at:[73,79],go:'collection'},
];
const PATH=['hop','tetsu','ran','iwaki','raiga','hyomi','nova','blaze','shadow','ryuoh'];
const reduced=()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const baseOf=bey=>(bey?.id||'').includes('-')?bey.id.split('-').pop():bey?.id;

// Stage: fixed 16:9 world that "contains" on landscape screens (map edges are paper-white so the
// letterbox blends in) and fits height + pans horizontally on portrait phones.
function useStage(){
  const [st,setSt]=useState({w:1280,h:720,pan:false});
  useLayoutEffect(()=>{
    const f=()=>{const W=window.innerWidth,H=window.innerHeight;
      if(W/H>=1.15){const s=Math.min(W/16,H/9);setSt({w:s*16,h:s*9,pan:false});}
      else setSt({w:H*16/9,h:H,pan:true});};
    f();window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);
  },[]);
  return st;
}

function Medallion({b,state,onClick}){
  const [ok,setOk]=useState(true);
  return (
    <button className={`wm-spot ${state.cls}`} style={{left:`${SPOTS[b.id][0]}%`,top:`${SPOTS[b.id][1]}%`,'--c':b.color}} onClick={onClick} disabled={state.locked} aria-label={`${b.name}${state.locked?'（未解锁）':''}`}>
      <span className="wm-ring"/>
      <span className="wm-face">{ok?<img src={`/art/bladers/${b.id}.png`} alt="" onError={()=>setOk(false)}/>:<b>{b.name[0]}</b>}</span>
      <span className="wm-name">{b.name}</span>
      {state.beat&&<span className="wm-stamp">✓ 已击败</span>}
      {state.recruited&&<span className="wm-flag" title="已入队">队</span>}
    </button>
  );
}

function PlaceIcon({kind}){
  if(kind==='scroll')return <svg viewBox="0 0 64 64"><rect x="14" y="12" width="36" height="40" fill="#fbf8f1" stroke="#111" strokeWidth="3"/><rect x="8" y="8" width="48" height="8" rx="4" fill="#c33" stroke="#111" strokeWidth="3"/><rect x="8" y="48" width="48" height="8" rx="4" fill="#c33" stroke="#111" strokeWidth="3"/><path d="M22 24h20M22 31h20M22 38h14" stroke="#111" strokeWidth="2.5"/></svg>;
  return <svg viewBox="0 0 64 64"><path d="M16 24q0-12 16-12t16 12v26q0 4-4 4H20q-4 0-4-4z" fill="#d9a441" stroke="#111" strokeWidth="3"/><path d="M24 20q0-6 8-6t8 6" fill="none" stroke="#111" strokeWidth="3"/><rect x="22" y="32" width="20" height="12" rx="2" fill="#fbf8f1" stroke="#111" strokeWidth="3"/><circle cx="32" cy="38" r="3" fill="#111"/></svg>;
}

function Place({p,count,onClick}){
  return (
    <button className={`wm-place wm-place-${p.id}`} style={{left:`${p.at[0]}%`,top:`${p.at[1]}%`}} onClick={onClick}>
      <span className="wm-place-win" style={p.img?{background:`url(${p.img}) ${p.crop} no-repeat #fbf8f1`}:undefined}>{!p.img&&<PlaceIcon kind={p.icon}/>}</span>
      {p.doctor&&<img className="wm-peek" src="/art/doctor/excited.png" alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}
      <span className="wm-place-l">{p.label}{count!=null&&<em>{count}</em>}</span>
    </button>
  );
}

function CharacterPage({b,save,onBack,onChallenge,closing}){
  const [beyImg,setBeyImg]=useState(true);
  const [faceOk,setFaceOk]=useState(true);
  const beat=save.defeated.includes(b.id), recruited=save.team.some(t=>t.bladerId===b.id);
  return (
    <div className={`wm-page ${closing?'closing':''}`} style={{'--c':b.color}} role="dialog" aria-label={`${b.name} 的页面`}>
      <div className="wm-sheet">
        <section className="wm-p wm-p-hero">
          <div className="wm-burst"/>
          {faceOk?<img className="wm-hero-img" src={`/art/bladers/${b.id}.png`} alt={b.name} onError={()=>setFaceOk(false)}/>:<div className="wm-hero-fallback">{b.name[0]}</div>}
          <div className="wm-hero-kicker">{TIERS[b.tier].label}</div>
          <h2 className="wm-hero-name">{b.name}</h2>
          {beat&&<div className="wm-hero-stamp">已击败</div>}
          {recruited&&<div className="wm-hero-team">我的队员</div>}
        </section>
        <section className="wm-p wm-p-talk">
          <div className="wm-balloon">「{b.line}」</div>
          <div className="wm-sfx">ゴゴゴ…</div>
        </section>
        <section className="wm-p wm-p-bey">
          <div className="wm-bey-art">{beyImg?<img src={`/art/beys/${baseOf(b.bey)}.png`} alt={b.bey.name} onError={()=>setBeyImg(false)}/>:<BeyArt bey={b.bey} size={150}/>}</div>
          <div className="wm-bey-info">
            <div className="wm-bey-cap">使用陀螺</div>
            <div className="wm-bey-name">{b.bey.name}</div>
            <TypeBadge type={b.bey.type}/>
            <div className="wm-bey-parts">Ratchet {b.bey.ratchet?.prongs||3}-{b.bey.ratchet?.height||60} · Bit {b.bey.bit}</div>
          </div>
        </section>
        <section className="wm-p wm-p-act">
          <button className="wm-back" onClick={onBack}>← 返回地图</button>
          <button className="wm-go" onClick={onChallenge}><span>挑战！</span></button>
        </section>
      </div>
    </div>
  );
}

export default function MapScreen(){
  const {save,go,setDemo}=useGame();
  const stage=useStage();
  const [focus,setFocus]=useState(null);   // {b, x, y} zooming / open
  const [page,setPage]=useState(null);     // blader whose page is open
  const [closing,setClosing]=useState(false);
  const panRef=useRef();
  const open=t=>save.demo||tierUnlocked(t,save);

  // Fog clears once per tier when it becomes unlocked.
  const [clearing]=useState(()=>Object.keys(TIER_FOG).filter(t=>{
    if(!tierUnlocked(t,save))return false; // real unlocks only (demo mode doesn't consume the animation)
    const k=`kos.seenUnlocked.${t}`;try{if(localStorage.getItem(k))return false;localStorage.setItem(k,'1');}catch{return false;}return true;
  }));

  useEffect(()=>{ // phones: start panned to the village
    if(stage.pan&&panRef.current)panRef.current.scrollLeft=0;
  },[stage.pan]);

  const enter=b=>{
    const [x,y]=SPOTS[b.id];
    setFocus({b,x,y});
    setTimeout(()=>{setPage(b);setClosing(false);},reduced()?0:520);
  };
  const back=()=>{
    if(reduced()){setPage(null);setFocus(null);return;}
    setClosing(true);
    setTimeout(()=>{setPage(null);setClosing(false);setFocus(null);},520);
  };

  const team=save.team.map(t=>bladerById(t.bladerId)).filter(Boolean);
  const pathD=useMemo(()=>PATH.map((id,i)=>`${i?'L':'M'}${SPOTS[id][0]*19.2},${SPOTS[id][1]*10.8}`).join(' '),[]);

  return (
    <div className="wm">
      <header className="wm-hud">
        <button className="wm-hud-back" onClick={()=>go('title')}>◀</button>
        <div className="wm-hud-title">冒险地图</div>
        <div className="wm-hud-chips">
          <span>🪙 {save.coins}</span>
          <span>陀螺 {save.collection.length}/3</span>
          <span>队员 {save.team.length}/3</span>
          {team.length>0&&<span className="wm-hud-team">{team.map(b=><img key={b.id} src={`/art/bladers/${b.id}.png`} alt={b.name} title={b.name}/>)}</span>}
          <label className="wm-hud-demo" title="演示模式：解锁全部对手"><input type="checkbox" checked={!!save.demo} onChange={e=>setDemo(e.target.checked)}/>演示</label>
        </div>
      </header>

      <div ref={panRef} className={`wm-viewport ${stage.pan?'pan':''}`}>
        <div className={`wm-stage ${focus?'zoom':''} ${page&&!closing?'hidden':''}`} style={{width:stage.w,height:stage.h,'--sw':`${stage.w}px`,transformOrigin:focus?`${focus.x}% ${focus.y}%`:'50% 50%'}}>
          <img className="wm-art" src="/art/bg/map.jpg" alt="" draggable={false}/>
          <svg className="wm-path" viewBox="0 0 1920 1080" preserveAspectRatio="none"><path d={pathD}/></svg>
          <div className="wm-calli">陀螺王国<small>KINGDOM OF SPINS</small></div>

          {Object.entries(TIER_FOG).map(([tier,blobs])=>(!open(tier)||clearing.includes(tier))&&(
            <div key={tier} className={`wm-fog-group ${open(tier)&&clearing.includes(tier)?'clearing':''}`}>
              {blobs.map(([x,y],i)=><div key={i} className="wm-fog" style={{left:`${x}%`,top:`${y}%`,animationDelay:`${-i*2.3}s`}}/>)}
            </div>
          ))}

          {BLADERS.map(b=>{
            const locked=!open(b.tier), beat=save.defeated.includes(b.id), recruited=save.team.some(t=>t.bladerId===b.id);
            return <Medallion key={b.id} b={b} state={{locked,beat,recruited,cls:`${locked?'locked':''} ${beat?'beat':''} tier-${b.tier}`}} onClick={()=>enter(b)}/>;
          })}

          {Object.entries(LOCK_AT).map(([tier,[x,y]])=>!open(tier)&&(
            <div key={tier} className="wm-lock" style={{left:`${x}%`,top:`${y}%`}}>
              <span className="wm-lock-string"/>
              <span className="wm-lock-tag"><b>🔒 {TIERS[tier].label}</b>{TIERS[tier].req}</span>
            </div>
          ))}

          {PLACES.map(p=><Place key={p.id} p={p} count={p.id==='codex'?save.cards.length:p.id==='collection'?save.collection.length:null} onClick={()=>go(p.go)}/>)}
        </div>
      </div>

      {stage.pan&&!page&&<div className="wm-swipe">👆 左右拖动地图，去看看远方</div>}
      <div className="wm-doctor">
        <DoctorFace size={86}/>
        <div className="wm-doctor-say">{hint(save)}</div>
      </div>

      {page&&<CharacterPage b={page} save={save} closing={closing} onBack={back} onChallenge={()=>go('battle',{bladerId:page.id})}/>}
    </div>
  );
}

export function DoctorFace({mood='normal',size=72}){
  const [failed,setFailed]=useState(false);
  if(!failed)return <img src={`/art/doctor/${mood}.png`} width={size} height={size} alt="融合博士" style={{objectFit:'contain',flex:'none'}} onError={()=>setFailed(true)}/>;
  return <div style={{width:size,height:size,flex:'none',borderRadius:'50%',border:'var(--border)',background:'radial-gradient(circle at 35% 40%, #111 0 6%, transparent 7%), radial-gradient(circle at 65% 40%, #111 0 6%, transparent 7%), radial-gradient(ellipse at 50% 70%, #111 0 10%, transparent 11%), var(--yellow)',display:'grid',placeItems:'end center'}}><span style={{fontSize:10,fontWeight:900,background:'#fff',border:'2px solid #111',padding:'0 4px',marginBottom:-8}}>博士</span></div>;
}
