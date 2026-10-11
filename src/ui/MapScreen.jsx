import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useGame,bladerById} from '../game/store.js';
import {useTaskScope} from '../game/useTaskScope.js';
import {BLADERS,TIERS,tierUnlocked} from '../game/story.js';
import {REGIONS,regionUnlocked} from '../game/regions.js';
import {BEYS} from '../game/beys.js';
import {TypeBadge} from './common.jsx';
import BeyArt from './BeyArt.jsx';
import './map.css';

// Illustrated world map: the ink-wash map IS the page. Bladers and places are hotspots on the
// landscape; tapping one zooms the camera in and page-flips into a full comic page.

const prog=(save,r)=>{const e=save.explore?.[r.id]||{};const met=new Set([...(e.met||[]),...r.bladers.filter(id=>save.defeated.includes(id))]);
  return {found:(e.found||[]).filter(id=>r.beys.includes(id)).length,met:r.bladers.filter(id=>met.has(id)).length,metSet:met,foundSet:new Set(e.found||[])};};
const realUnlocked=(r,save)=>regionUnlocked(r,{...save,demo:false});

function hint(save){
  const [harbor,thunder]=REGIONS, ph=prog(save,harbor), pt=prog(save,thunder);
  if(ph.found<harbor.beys.length&&!ph.met)return '去新手港湾探险吧！找找藏起来的陀螺，还能遇到会和你对战的小伙伴。';
  if(ph.found<harbor.beys.length)return `新手港湾还藏着 ${harbor.beys.length-ph.found} 只陀螺，再去找找看！`;
  if(!realUnlocked(thunder,save)&&!save.demo)return `再有 ${Math.max(0,3-save.collection.length)} 只陀螺，雷霆山脉的雾就会散开！试试商店盲盒或融合工坊？`;
  if(pt.met<thunder.bladers.length)return '雷霆山脉开放了！去山里找职业对手，打败他们就能邀请他们入队。';
  if(save.team.length<3)return '打败职业对手，就能邀请他们加入你的队伍！';
  return '龙焰火山岛的龙王在等你……准备好你最强的陀螺吧！';
}

// Positions in % of the 1536×1024 (3:2) world map art. pin = landmark, card = where the badge floats.
const REGION_POS={
  harbor:{pin:[12.5,65],card:[18,45]},    // red-roof harbour town + lighthouse
  thunder:{pin:[34.5,16],card:[53,23]},   // blue spiral tower; card over the open sea
  volcano:{pin:[89,12],card:[84,38]},     // dragon castle; card over the lava fields
};
const REGION_FOG={thunder:[[14,16],[30,10],[40,25],[24,30],[8,34],[46,14]],volcano:[[74,30],[85,20],[90,9],[84,46],[93,58],[77,60],[96,36],[71,46]]};
const PLACES=[
  {id:'shop',label:'盲盒商店',img:'/art/bg/shop.jpg',crop:'50% 50% / cover',at:[43,78],go:'shop'},        // striped-awning stall
  {id:'fusion',label:'AI 融合工坊',img:'/art/bg/lab.jpg',crop:'50% 50% / cover',at:[47,63],go:'fusion',doctor:true}, // globe-dome lab
  {id:'versus',label:'对战道场',img:'/art/bg/arena.jpg',crop:'50% 50% / cover',at:[59,68],go:'versus'},  // round red arena hall
  {id:'codex',label:'知识图鉴',icon:'scroll',at:[68,75],go:'codex'},                                      // domed library
  {id:'collection',label:'我的陀螺',icon:'bag',at:[54,84],go:'collection'},                               // small pagoda
];
const reduced=()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const baseOf=bey=>(bey?.id||'').includes('-')?bey.id.split('-').pop():bey?.id;

// Stage: fixed 3:2 world that "contains" on landscape screens (a blurred copy of the map fills the
// letterbox) and fits height + pans horizontally on portrait phones.
function useStage(){
  const [st,setSt]=useState({w:1280,h:720,pan:false});
  useLayoutEffect(()=>{
    const f=()=>{const W=window.innerWidth,H=window.innerHeight;
      if(W/H>=1.15){const s=Math.min(W/3,H/2);setSt({w:s*3,h:s*2,pan:false});}
      else setSt({w:H*3/2,h:H,pan:true});};
    f();window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);
  },[]);
  return st;
}

function Face({id,lit,size}){
  const b=BLADERS.find(x=>x.id===id),joined=useGame(st=>st.save.team.some(t=>t.bladerId===id));
  return <span className={`wm-mini ${lit?'lit':''} ${joined?'joined':''}`} title={joined?`${b?.name}（已入队）`:lit?`${b?.name}（已认识）`:'？？？'} style={{'--c':b?.color,width:size,height:size}}><img src={`/art/bladers/${id}.png`} alt="" onError={e=>{e.currentTarget.style.display='none';}}/></span>;
}
function BeyChip({id,lit}){
  return <span className={`wm-beychip ${lit?'lit':''}`} title={lit?BEYS[id]?.name:'？？？'}><img src={`/art/beys/${id}.png`} alt="" onError={e=>{e.currentTarget.style.display='none';}}/></span>;
}

// One clear status plate per region (same layout everywhere): what's done, what unlocks it, what to do next.
function regionState(r,save,locked){
  const p=prog(save,r), beat=r.bladers.filter(id=>save.defeated.includes(id)).length;
  const treasure=`寻宝 ${p.found>=r.beys.length?'✓':`${p.found}/${r.beys.length}`}`;
  if(r.unlock?.team){ // volcano: team gate, exploration not built yet
    const n=Math.min(3,save.team.length), open=save.demo||n>=r.unlock.team;
    return open?{tone:'hot',icon:'🔥',main:'可以挑战超级职业！',stats:`打败 ${beat}/${r.bladers.length}`,go:'挑战 ▶',note:'探索地图即将开放'}
      :{tone:'lock',icon:'🔒',main:'队伍满 3 人解锁',now:`现在 ${n}/3`,dots:[n,3],note:'探索地图即将开放'};
  }
  if(locked&&r.unlock?.beys){const n=Math.min(r.unlock.beys,save.collection.length);
    return {tone:'lock',icon:'🔒',main:`收集 ${r.unlock.beys} 只陀螺解锁`,now:`现在 ${n}/${r.unlock.beys}`,dots:[n,r.unlock.beys]};}
  const mates=(r.recruitable||[]).filter(id=>save.team.some(t=>t.bladerId===id)).length;
  const stats=r.recruitable?.length?`${treasure} · 已入队 ${mates}/${r.recruitable.length}`:`${treasure} · 打败 ${beat}/${r.bladers.length}`;
  const done=p.found>=r.beys.length&&beat>=r.bladers.length;
  return {tone:done?'done':'open',icon:done?'🏅':'🧭',main:done?'全部完成！':'可以探险',stats,go:'进入探险 ▶'};
}
function RegionState({st}){
  return <span className={`wm-state ${st.tone}`}>
    <span className="wm-state-main"><i>{st.icon}</i>{st.main}</span>
    {st.dots&&<span className="wm-state-dots">{Array.from({length:st.dots[1]},(_,k)=><b key={k} className={k<st.dots[0]?'on':''}/>)}<em>{st.now}</em></span>}
    {st.stats&&<span className="wm-state-stats">{st.stats}</span>}
    {st.go&&<span className="wm-state-go">{st.go}</span>}
    {st.note&&<small className="wm-state-note">{st.note}</small>}
  </span>;
}

function RegionBadge({r,save,locked,onClick}){
  const pos=REGION_POS[r.id], p=prog(save,r);
  return (
    <>
      <span className={`wm-pin ${locked?'locked':''}`} style={{left:`${pos.pin[0]}%`,top:`${pos.pin[1]}%`,'--c':r.color}}><i/></span>
      <button className={`wm-region ${locked?'locked':''} ${r.comingSoon?'soon':''}`} style={{left:`${pos.card[0]}%`,top:`${pos.card[1]}%`,'--c':r.color}} onClick={onClick}
        aria-label={`${r.name}${locked?'（未解锁）':''}`}>
        <span className="wm-region-glow"/>
        <span className="wm-region-order">{['壹','贰','叁'][r.order-1]||r.order}</span>
        <span className="wm-region-name">{r.name}</span>
        <span className="wm-region-sub">{r.en} · {r.landform}</span>
        <span className="wm-region-row"><em>陀螺 {p.found}/{r.beys.length}</em>{r.beys.map(id=><BeyChip key={id} id={id} lit={p.foundSet.has(id)}/>)}</span>
        <span className="wm-region-row"><em>已认识 {p.met}/{r.bladers.length}</em>{r.bladers.map(id=><Face key={id} id={id} lit={p.metSet.has(id)}/>)}</span>
        <RegionState st={regionState(r,save,locked)}/>
      </button>
    </>
  );
}

// Comic page listing a region's bladers (used for the volcano's direct-challenge path).
function RegionPicker({r,save,closing,onPick,onBack}){
  const open=b=>save.demo||tierUnlocked(b.tier,save);
  const list=r.bladers.map(id=>BLADERS.find(b=>b.id===id)).filter(Boolean);
  return (
    <div className={`wm-page ${closing?'closing':''}`} style={{'--c':r.color}} role="dialog" aria-label={r.name}>
      <div className="wm-sheet wm-picker">
        <header className="wm-picker-head"><span className="wm-picker-name">{r.name}</span><span className="wm-picker-sub">{r.landform} · 即将开放探险 · 现在可以直接挑战</span></header>
        <div className="wm-picker-grid">
          {list.map(b=>{const ok=open(b), beat=save.defeated.includes(b.id);return (
            <button key={b.id} className={`wm-p wm-pick ${ok?'':'locked'} ${b.tier==='boss'?'boss':''}`} style={{'--c':b.color}} onClick={()=>ok&&onPick(b)} disabled={!ok}>
              <img className="wm-pick-img" src={`/art/bladers/${b.id}.png`} alt=""/>
              <span className="wm-pick-tier">{TIERS[b.tier].label}</span>
              <span className="wm-pick-name">{b.name}</span>
              {beat&&<span className="wm-pick-beat">已击败</span>}
              {!ok&&<span className="wm-pick-lock">🔒 {TIERS[b.tier].req}</span>}
            </button>);})}
        </div>
        <section className="wm-p wm-p-act"><button className="wm-back" onClick={onBack}>← 返回地图</button><span className="wm-picker-tip">点一位对手，看看他的陀螺</span></section>
      </div>
    </div>
  );
}

// "进入区域" title page that flips in before navigating to the explore screen.
function EnterCard({r}){
  return (
    <div className="wm-page" style={{'--c':r.color}}>
      <div className="wm-sheet wm-enter" style={{backgroundImage:`url(/art/regions/${r.id}.jpg)`}}>
        <div className="wm-burst"/>
        <div className="wm-enter-k">REGION {r.order}</div>
        <div className="wm-enter-name">{r.name}</div>
        <div className="wm-enter-sub">{r.en} · {r.landform}</div>
        <div className="wm-enter-go">进入区域…</div>
      </div>
    </div>
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
  const tasks=useTaskScope();
  const {save,go,setDemo}=useGame();
  const stage=useStage();
  const [focus,setFocus]=useState(null);   // {x,y} zoom origin (%)
  const [picker,setPicker]=useState(null); // region whose blader picker is open
  const [page,setPage]=useState(null);     // blader whose character page is open
  const [entering,setEntering]=useState(null);
  const [closing,setClosing]=useState(false);
  const panRef=useRef();
  const locked=r=>!regionUnlocked(r,save);

  // Fog clears once per region when it becomes unlocked for real (demo mode doesn't consume it).
  const [clearing]=useState(()=>REGIONS.filter(r=>r.unlock&&realUnlocked(r,save)).map(r=>r.id).filter(id=>{
    const k=`kos.seenUnlocked.region.${id}`;try{if(localStorage.getItem(k))return false;localStorage.setItem(k,'1');}catch{return false;}return true;
  }));
  useEffect(()=>{if(stage.pan&&panRef.current)panRef.current.scrollLeft=0;},[stage.pan]);

  const wait=ms=>reduced()?0:ms;
  const zoomTo=r=>{const [x,y]=REGION_POS[r.id].pin;setFocus({x,y});};
  const tapRegion=r=>{
    tasks.cancel();
    if(r.comingSoon){zoomTo(r);tasks.schedule(()=>{setPicker(r);setClosing(false);},wait(520));return;}
    if(locked(r))return;
    zoomTo(r);
    tasks.schedule(()=>setEntering(r),wait(480));
    tasks.schedule(()=>go('explore',{regionId:r.id}),wait(1350));
  };
  const closePage=()=>{ // character page -> back to picker (volcano)
    if(reduced()){setPage(null);return;}
    setClosing(true);tasks.schedule(()=>{setPage(null);setClosing(false);},480);
  };
  const closePicker=()=>{
    if(reduced()){setPicker(null);setFocus(null);return;}
    setClosing(true);tasks.schedule(()=>{setPicker(null);setClosing(false);setFocus(null);},480);
  };

  const team=save.team.map(t=>bladerById(t.bladerId)).filter(Boolean);
  const pathD=useMemo(()=>REGIONS.map((r,i)=>`${i?'L':'M'}${REGION_POS[r.id].pin[0]*15.36},${REGION_POS[r.id].pin[1]*10.24}`).join(' '),[]);
  const overlay=!!(picker||page||entering);

  return (
    <div className="wm">
      <header className="wm-hud">
        <button className="wm-hud-back" onClick={()=>go('title')}>◀</button>
        <div className="wm-hud-title">冒险地图</div>
        <div className="wm-hud-chips">
          <span>🪙 {save.coins}</span>
          <span>陀螺 {save.collection.length}</span>
          <span>已入队 {save.team.length}/3</span>
          {team.length>0&&<span className="wm-hud-team">{team.map(b=><img key={b.id} src={`/art/bladers/${b.id}.png`} alt={b.name} title={b.name}/>)}</span>}
          <label className="wm-hud-demo" title="演示模式：解锁全部区域和对手"><input type="checkbox" checked={!!save.demo} onChange={e=>setDemo(e.target.checked)}/>演示</label>
        </div>
      </header>

      <div ref={panRef} className={`wm-viewport ${stage.pan?'pan':''}`}>
        <div className={`wm-stage ${focus?'zoom':''} ${overlay&&!closing?'hidden':''}`} style={{width:stage.w,height:stage.h,'--sw':`${stage.w}px`,transformOrigin:focus?`${focus.x}% ${focus.y}%`:'50% 50%'}}>
          <img className="wm-art" src="/art/bg/map.jpg" alt="" draggable={false}/>
          <svg className="wm-path" viewBox="0 0 1536 1024" preserveAspectRatio="none"><path d={pathD}/></svg>

          {REGIONS.map(r=>REGION_FOG[r.id]&&(locked(r)||clearing.includes(r.id))&&(
            <div key={r.id} className={`wm-fog-group fog-${r.id} ${!locked(r)&&clearing.includes(r.id)?'clearing':''}`}>
              {REGION_FOG[r.id].map(([x,y],i)=><div key={i} className="wm-fog" style={{left:`${x}%`,top:`${y}%`,animationDelay:`${-i*2.3}s`}}/>)}
            </div>
          ))}

          {/* 漫画引线：把每张区域卡和它在地图上的地标点连起来 */}
          <svg className="wm-leads" viewBox="0 0 1536 1024" preserveAspectRatio="none">{REGIONS.map(r=>{const {pin,card}=REGION_POS[r.id];return <g key={r.id} style={{'--c':r.color}}>
            <line x1={pin[0]*15.36} y1={pin[1]*10.24} x2={card[0]*15.36} y2={card[1]*10.24} className="wm-lead-bg"/>
            <line x1={pin[0]*15.36} y1={pin[1]*10.24} x2={card[0]*15.36} y2={card[1]*10.24} className="wm-lead"/></g>;})}</svg>
          {REGIONS.map(r=><RegionBadge key={r.id} r={r} save={save} locked={locked(r)} onClick={()=>tapRegion(r)}/>)}

          {PLACES.map(p=><Place key={p.id} p={p} count={p.id==='codex'?save.cards.length:p.id==='collection'?save.collection.length:null} onClick={()=>go(p.go)}/>)}
        </div>
      </div>

      {stage.pan&&!overlay&&<div className="wm-swipe">👆 左右拖动地图，去看看远方</div>}
      <div className="wm-doctor">
        <DoctorFace size={86}/>
        <div className="wm-doctor-say">{hint(save)}</div>
      </div>

      {picker&&!page&&<RegionPicker r={picker} save={save} closing={closing} onPick={b=>{setPage(b);setClosing(false);}} onBack={closePicker}/>}
      {page&&<CharacterPage b={page} save={save} closing={closing} onBack={closePage} onChallenge={()=>go('battle',{bladerId:page.id})}/>}
      {entering&&<EnterCard r={entering}/>}
    </div>
  );
}

export function DoctorFace({mood='normal',size=72}){
  const [failed,setFailed]=useState(false);
  if(!failed)return <img src={`/art/doctor/${mood}.png`} width={size} height={size} alt="融合博士" style={{objectFit:'contain',flex:'none'}} onError={()=>setFailed(true)}/>;
  return <div style={{width:size,height:size,flex:'none',borderRadius:'50%',border:'var(--border)',background:'radial-gradient(circle at 35% 40%, #111 0 6%, transparent 7%), radial-gradient(circle at 65% 40%, #111 0 6%, transparent 7%), radial-gradient(ellipse at 50% 70%, #111 0 10%, transparent 11%), var(--yellow)',display:'grid',placeItems:'end center'}}><span style={{fontSize:10,fontWeight:900,background:'#fff',border:'2px solid #111',padding:'0 4px',marginBottom:-8}}>博士</span></div>;
}
