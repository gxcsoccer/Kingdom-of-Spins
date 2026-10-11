import {useCallback,useEffect,useRef,useState} from 'react';
import {useGame} from '../game/store.js';
import {regionById,emptyExplore} from '../game/regions.js';
import {BEYS} from '../game/beys.js';
import {BLADERS} from '../game/story.js';
import {getCard} from '../knowledge/cards.js';
import KnowledgeCard from '../knowledge/KnowledgeCard.jsx';
import {flipImage} from '../flipbook/api.js';
import {sceneUrl,sceneByKey} from '../game/scenes.js';
import {speak,stopSpeaking,ttsSupported} from '../fusion/voice.js';
import BeyArt from '../ui/BeyArt.jsx';
import {Portrait} from '../ui/common.jsx';
import * as sfx from '../game/sfx.js';
import {exploreStep} from './api.js';
import ProtoArchive from './ProtoArchive.jsx';
import {prototypeOf} from '../game/prototypes.js';
import '../flipbook/flipbook.css';
import '../ui/result/result.css';
import './explore.css';

const bladerById=id=>BLADERS.find(b=>b.id===id);
const MAX_TRAIL=30;
const OVERLAY_TYPES=new Set(['find_bey','meet_blader','gate','geo_fact','complete']);
const pageText=p=>[p.title,...p.panels.map(x=>x.text)].join('。');
// Image source chain: pre-generated scene → region cover → (custom shot) FLUX → CSS ink sketch. Never blank.
function SceneImage({regionId,page,onFlux}){
  const srcs=[page.sceneKey&&sceneUrl(regionId,page.sceneKey),`/art/regions/${regionId}.jpg`].filter(Boolean);
  const [i,setI]=useState(0);const [flux,setFlux]=useState(null);
  useEffect(()=>{setI(0);setFlux(null);if(!page.sceneKey&&page.imagePrompt)flipImage(page.imagePrompt).then(u=>u&&setFlux(u));},[page.id]);// eslint-disable-line
  if(flux)return <img src={flux} alt="" draggable={false}/>;
  if(i<srcs.length)return <img key={srcs[i]} src={srcs[i]} alt="" draggable={false} onError={()=>setI(n=>n+1)}/>;
  return <div className="ex-sketch"><span>{page.title}</span></div>;
}
function TypeLine({text}){
  const [n,setN]=useState(0);
  useEffect(()=>{setN(0);if(!text)return;const t=setInterval(()=>setN(k=>{if(k>=text.length){clearInterval(t);return k;}return k+1;}),35);return()=>clearInterval(t);},[text]);
  return <>{text.slice(0,n)}<span className="ex-caret">{n<text.length?'▍':''}</span></>;
}
const nearestSpot=(page,x,y)=>{let best=0,d=9;page.hotspots.forEach((h,i)=>{const e=Math.hypot(h.x-x,h.y-y);if(e<d){d=e;best=i;}});return best;};

/** 区域探索：AI Game Master 即兴生成的漫画冒险。params: {regionId} */
export default function ExploreScreen(){
  const {params,save,go,updateExplore,findBey,meetBlader,unlockCards,addCoins}=useGame();
  const region=regionById(params.regionId)||regionById('harbor');
  const ex=save.explore?.[region.id]||emptyExplore();
  const gm=ex.gm&&typeof ex.gm==='object'?ex.gm:null;
  const [entries,setEntries]=useState(()=>(gm?.trail||[]).map(t=>({page:t.page,tapped:t.tapped,image:null})));
  const [idx,setIdx]=useState(()=>Math.min(gm?.idx??0,Math.max(0,(gm?.trail?.length||1)-1)));
  const [busy,setBusy]=useState(false);
  const [tap,setTap]=useState(null);
  const [queue,setQueue]=useState([]);            // pending event overlays
  const [narration,setNarration]=useState(gm?.narration||'');
  const [clues,setClues]=useState(gm?.clues||[]);
  const [voice,setVoice]=useState(false);
  const [shake,setShake]=useState(false);
  const [archive,setArchive]=useState(false);
  const [moving,setMoving]=useState(null);   // provisional page shown instantly while a move's text is written
  const alive=useRef(true);
  const cur=entries[idx];
  const pendingGate=gm?.pendingGate||null;

  const prefetch=useRef(new Map());   // `${pageId}:${spot}` → Promise<step response>
  const lastEvents=useRef([]);          // events of the newest page (for projecting state when prefetching)
  useEffect(()=>()=>{alive.current=false;stopSpeaking();},[]);
  // Server state for the next step. project=true assumes the newest page's finds/meets were accepted.
  const buildState=useCallback((project=false)=>{
    const e=useGame.getState().save.explore?.[region.id]||emptyExplore();
    const g=(e.gm&&typeof e.gm==='object')?e.gm:{};
    const found=new Set(e.found),met=new Set(e.met);
    if(project)for(const v of lastEvents.current){if(v.type==='find_bey')found.add(v.beyId);if(v.type==='meet_blader')met.add(v.bladerId);}
    return {found:[...found],met:[...met],steps:e.steps,runs:e.runs,sinceLast:g.sinceLast||0,gm:g.memory||'',trail:(g.trail||[]).map(t=>t.page.title),scene:g.scene,hidePlan:g.hidePlan||null,sinceGate:g.sinceGate??9,scenes:(g.trail||[]).map(t=>t.page.sceneKey).filter(Boolean),pendingGate:g.pendingGate||null};
  },[region.id]);
  useEffect(()=>{if(voice&&cur)speak([narration,pageText(cur.page)].filter(Boolean).join('。'));},[voice,cur?.page.id]);// eslint-disable-line

  const step=useCallback(async(action,ready=null)=>{
    if(busy)return;setBusy(true);stopSpeaking();
    const e=useGame.getState().save.explore?.[region.id]||emptyExplore();
    const g=(e.gm&&typeof e.gm==='object')?e.gm:{};
    const r0=await(ready||exploreStep({regionId:region.id,state:buildState(),action}));
    if(!alive.current)return;
    // A prefetched step may predate accepted finds/meets: drop anything already collected.
    const cur2=useGame.getState().save.explore?.[region.id]||emptyExplore();
    const events=(r0.events||[]).filter(v=>!(v.type==='find_bey'&&cur2.found.includes(v.beyId))&&!(v.type==='meet_blader'&&cur2.met.includes(v.bladerId)));
    const r={...r0,events,awarded:events.some(v=>v.type==='find_bey'||v.type==='meet_blader')};
    lastEvents.current=events;prefetch.current.clear();setMoving(null);
    const gate=r.events.find(x=>x.type==='gate');
    const newClues=r.events.filter(x=>x.type==='clue').map(x=>x.text);
    const at=action.type==='enter'?0:(g.trail?.length||0);
    updateExplore(region.id,x=>{
      const gg=(x.gm&&typeof x.gm==='object')?x.gm:{};
      const trail=[...(action.type==='enter'?[]:(gg.trail||[])),{page:r.page,tapped:r.tapped||(action.type==='inspect'?action.label||'':'')}].slice(-MAX_TRAIL);
      x.gm={...gg,memory:r.gmMemory||gg.memory||'',scene:r.scene||gg.scene,hidePlan:r.hidePlan||gg.hidePlan,trail,idx:trail.length-1,sinceLast:r.awarded?0:(action.type==='enter'?0:(gg.sinceLast||0)+1),
        pendingGate:gate?{quizId:gate.quizId,lead:gate.lead,q:gate.q,answer:gate.answer,explain:gate.explain,options:gate.options,cardId:gate.cardId}:(action.type==='answer'?null:gg.pendingGate||null),
        sinceGate:gate?0:(gg.sinceGate??9)+1,narration:r.narration||'',clues:[...newClues,...(action.type==='enter'?[]:(gg.clues||[]))].slice(0,6)};
      if(action.type!=='enter')x.steps=(x.steps||0)+1;
    });
    setEntries(es=>[...(action.type==='enter'?[]:es.slice(0,at)),{page:r.page,tapped:r.tapped||(action.type==='inspect'?action.label||'':''),image:null}].slice(-MAX_TRAIL));
    setIdx(Math.min(at,MAX_TRAIL-1));
    setNarration(r.narration||'');
    if(newClues.length)setClues(c=>[...newClues,...(action.type==='enter'?[]:c)].slice(0,6));
    unlockCards([r.page.cardId]);
    setQueue(q=>[...q,...r.events.filter(x=>OVERLAY_TYPES.has(x.type))]);
    setTap(null);setBusy(false);
  },[busy,region.id,updateExplore,unlockCards,buildState]);

  // Prefetch: inspect the 2 most likely spots + move to every exit (moves already render instantly from the static image).
  useEffect(()=>{
    if(!cur||busy||idx!==entries.length-1||useGame.getState().save.explore?.[region.id]?.gm?.pendingGate||lastEvents.current.some(v=>v.type==='gate'||v.type==='complete'))return;
    const page=cur.page,state=buildState(true);
    const jobs=[...page.hotspots.slice(0,2).map((h,i)=>[`${page.id}:spot:${i}`,{type:'inspect',spot:i,label:h.label,page}]),...(page.exits||[]).map(x=>[`${page.id}:move:${x.key}`,{type:'move',to:x.key}])];
    for(const [k,action] of jobs){if(!prefetch.current.has(k))prefetch.current.set(k,exploreStep({regionId:region.id,state,action}));}
  },[cur?.page.id,busy]);// eslint-disable-line
  // First visit / new run.
  const started=useRef(false);
  useEffect(()=>{
    if(started.current||region.comingSoon)return;started.current=true;
    if(!gm?.trail?.length){updateExplore(region.id,x=>{x.runs=(x.runs||0)+1;x.gm={};});step({type:'enter'});}
    else if(gm.pendingGate)setQueue(q=>q.some(x=>x.type==='gate')?q:[{type:'gate',...gm.pendingGate}]);
  },[]);// eslint-disable-line

  function onImageTap(ev){
    if(!cur||busy)return;
    if(queue.length||pendingGate){setShake(true);setTimeout(()=>setShake(false),400);return;}
    if(idx!==entries.length-1){setIdx(entries.length-1);return;}   // only the newest page moves the story
    const r=ev.currentTarget.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));
    const spot=nearestSpot(cur.page,x,y),h=cur.page.hotspots[spot];
    setTap({x:h?.x??x,y:h?.y??y});
    step({type:'inspect',spot,label:h?.label,page:cur.page},prefetch.current.get(`${cur.page.id}:spot:${spot}`)||null);
  }
  function onMove(to){
    if(!cur||busy)return;
    if(queue.length||pendingGate){setShake(true);setTimeout(()=>setShake(false),400);return;}
    const sc=sceneByKey(region.id,to);
    if(sc)setMoving({id:'move-'+to,title:sc.title,panels:[],hotspots:sc.spots.map((p,i)=>({...p,spot:i,hint:''})),sceneKey:to,exits:sc.exits.map(k=>({key:k,title:sceneByKey(region.id,k)?.title||k}))});
    step({type:'move',to},prefetch.current.get(`${cur.page.id}:move:${to}`)||null);
  }
  const pop=()=>setQueue(q=>q.slice(1));
  const ev0=queue[0];

  if(region.comingSoon)return <div className="page dark ex-soon"><div className="panel" style={{padding:30,color:'#111',textAlign:'center'}}><div className="sfx" style={{fontSize:56}}>即将开放！</div><p style={{fontWeight:800}}>{region.name}（{region.landform}）还在建造中，敬请期待～</p><button className="btn primary big" onClick={()=>go('map')}>回到地图</button></div></div>;

  const found=new Set(ex.found),met=new Set(ex.met);
  const complete=region.beys.every(id=>found.has(id))&&region.bladers.every(id=>met.has(id));
  return (
    <div className="ex page dark" style={{'--rc':region.color}}>
      <div className="ex-main">
        <div className="ex-top">
          <button className="btn small" onClick={()=>go('map')}>◀ 地图</button>
          <div className="ex-region"><span className="kicker" style={{color:'var(--rc)'}}>{region.en}</span><b>{region.name}</b><small>{region.landform}</small></div>
          <div className="row" style={{gap:8}}>
            {ttsSupported&&<button className="btn small" onClick={()=>setVoice(v=>{if(v)stopSpeaking();return !v;})}>{voice?'🔊':'🔈'} 朗读</button>}
            <button className="btn small" onClick={()=>{if(confirm('重新开始这次探险？已经找到的陀螺和遇见的人会保留。')){updateExplore(region.id,x=>{x.gm={};x.runs=(x.runs||0)+1;});setEntries([]);setQueue([]);setClues([]);setIdx(0);step({type:'enter'});}}}>🔄 新的探险</button>
          </div>
        </div>
        <div className="ex-stage">
          {!cur&&<div className="fb-page fb-loading"><div className="fb-doodle"/><b>博士正在打开地图…</b></div>}
          {cur&&(()=>{const view=moving||cur.page;return <div className="fb-page fb-turn" key={view.id}>
            <div className="fb-title">{!moving&&cur.tapped&&<span className="fb-tapped">👆 {cur.tapped}</span>}<h2>{view.title}</h2></div>
            <div className={`fb-art ex-art ${shake?'shake':''}`} onClick={onImageTap}>
              <SceneImage regionId={region.id} page={view}/>
              {view.panels.map((p,i)=><div key={i} className={`fb-panel ${p.kind}`} style={{left:`${p.x*100}%`,top:`${p.y*100}%`,animationDelay:`${.15+i*.25}s`}}>{p.text}</div>)}
              {idx===entries.length-1&&view.hotspots.map((h,i)=><div key={i} className="fb-hot" style={{left:`${h.x*100}%`,top:`${h.y*100}%`,animationDelay:`${.4+i*.18}s`}}><i/><span>{h.label}</span></div>)}
              {tap&&<div className="fb-tap" style={{left:`${tap.x*100}%`,top:`${tap.y*100}%`}}/>}
              {busy&&<div className="fb-wait"><div className="fb-doodle small"/><b>{moving?'博士在写这里的故事…':'冒险继续中…'}</b></div>}
              {idx===entries.length-1&&(view.exits||[]).length>0&&<div className="ex-exits" onClick={e=>e.stopPropagation()}>{view.exits.map(x=><button key={x.key} className="ex-exit" disabled={busy} onClick={()=>onMove(x.key)}>→ {x.title}</button>)}</div>}
            </div>
          </div>;})()}
        </div>
        <div className="fb-strip ex-strip">{entries.map((e,i)=>(
          <button key={e.page.id+i} className={`fb-thumb ${i===idx?'on':''}`} onClick={()=>{if(!busy)setIdx(i);}}>
            {e.page.sceneKey?<img src={sceneUrl(region.id,e.page.sceneKey)} alt="" onError={ev=>{ev.currentTarget.style.visibility='hidden';}}/>:<span className="fb-thumb-ph"/>}<span className="fb-thumb-t">{i+1}. {e.page.title}</span>
          </button>))}</div>
      </div>

      <aside className="ex-side">
        <div className="ex-guide"><span className="ex-guide-face">博士</span><div className="bubble"><TypeLine text={narration||'点画面里任何你好奇的地方！'}/></div></div>
        <div className="ex-quest">
          <div className="ex-h">🌀 要找的陀螺 <small>{ex.found.length}/{region.beys.length}</small></div>
          <div className="ex-items">{region.beys.map(id=><div key={id} className={`ex-item ${found.has(id)?'got':''}`} title={found.has(id)?BEYS[id]?.name:'？？？'}><BeyArt bey={BEYS[id]} size={54}/><span>{found.has(id)?BEYS[id]?.name:'？？？'}</span></div>)}</div>
          <div className="ex-h">⚔️ 要遇见的陀螺手 <small>{ex.met.length}/{region.bladers.length}</small></div>
          <div className="ex-items">{region.bladers.map(id=>{const b=bladerById(id);const m=met.has(id);return <button key={id} className={`ex-item ${m?'got':''}`} disabled={!m} title={m?`再挑战 ${b?.name}`:'？？？'} onClick={()=>m&&go('battle',{bladerId:id,from:'explore',regionId:region.id})}><Portrait blader={b} size={54}/><span>{m?b?.name:'？？？'}</span></button>;})}</div>
          <div className="ex-steps">第 {(ex.runs||1)} 次探险 · 走了 {ex.steps||0} 步</div>
          {prototypeOf(region.id)&&<button className={`btn small ${complete?'yellow':''}`} style={{marginTop:8,width:'100%'}} disabled={!complete} onClick={()=>setArchive(true)}>{complete?'📜 真实原型档案':'📜 原型档案（全部收集后解锁）'}</button>}
        </div>
        {clues.length>0&&<div className="ex-clues"><div className="ex-h">🔍 线索本</div>{clues.slice(0,4).map((c,i)=><div key={i} className="ex-clue">{c}</div>)}</div>}
      </aside>

      {ev0&&<EventOverlay key={JSON.stringify(ev0)} ev={ev0} region={region}
        onFind={id=>{const b=findBey(region.id,id);sfx.beep?.(true);return b;}}
        onMeet={(id,fight)=>{meetBlader(region.id,id);pop();if(fight)go('battle',{bladerId:id,from:'explore',regionId:region.id});}}
        onGeo={id=>unlockCards([id])}
        onAnswer={(g,choice)=>{const ok=choice===g.answer;if(ok){addCoins(10);sfx.beep?.(true);}else sfx.beep?.();unlockCards([g.cardId]);return ok;}}
        onGateDone={(g,choice)=>{pop();updateExplore(region.id,x=>{if(x.gm)x.gm.pendingGate={...x.gm.pendingGate,answeredChoice:choice};});step({type:'answer',quizId:g.quizId,choice});}}
        onDone={pop} go={go} onArchive={()=>{pop();setArchive(true);}}/>}
      {archive&&<ProtoArchive regionId={region.id} onClose={()=>setArchive(false)}/>}
    </div>
  );
}

function EventOverlay({ev,region,onFind,onMeet,onGeo,onAnswer,onGateDone,onDone,go,onArchive}){
  const [choice,setChoice]=useState(null);
  const [got,setGot]=useState(null);
  useEffect(()=>{
    if(ev.type==='find_bey'){const b=onFind(ev.beyId);setGot(b||BEYS[ev.beyId]);}
    if(ev.type==='geo_fact'){onGeo(ev.cardId);const t=setTimeout(onDone,9000);return()=>clearTimeout(t);}
  },[]);// eslint-disable-line
  if(ev.type==='find_bey'){const bey=got||BEYS[ev.beyId];return (
    <div className="ex-ov ex-get" onClick={onDone}>
      <div className="ex-get-burst"/>
      <div className="ex-get-sfx">GET！</div>
      <div className="ex-get-bey"><BeyArt bey={bey} size={220} spin/></div>
      <div className="ex-get-name">{bey?.name} <small>{bey?.zh}</small></div>
      {ev.text&&<div className="bubble ex-get-text">{ev.text}</div>}
      <div className="ex-get-hint">已加入你的收藏 · 点任意处继续</div>
    </div>);}
  if(ev.type==='meet_blader'){const b=bladerById(ev.bladerId);return (
    <div className="ex-ov ex-meet" style={{'--bc':b?.color}}>
      <div className="ex-meet-band"><div className="ex-meet-lines"/><div className="ex-meet-face"><Portrait blader={b} size={220}/></div>
        <div className="ex-meet-text"><div className="kicker">ENCOUNTER</div><div className="ex-meet-name">{b?.name}</div><div className="ex-meet-line">「{ev.line||b?.line}」</div></div></div>
      <div className="row center" style={{gap:16}}><button className="btn primary big" onClick={()=>onMeet(ev.bladerId,true)}>⚔️ 挑战！</button><button className="btn big" onClick={()=>onMeet(ev.bladerId,false)}>稍后再来</button></div>
      <div className="ex-get-hint">遇见过的陀螺手可以随时在右边的名单里再挑战</div>
    </div>);}
  if(ev.type==='gate'){const done=choice!=null;const ok=done&&choice===ev.answer;return (
    <div className="ex-ov ex-gate-wrap">
      <div className="panel ex-gate pop-in">
        <div className="kicker" style={{color:'var(--red)'}}>🚧 关卡 · 答对才能继续</div>
        {ev.lead&&<div className="ex-gate-lead">{ev.lead}</div>}
        <div className="ex-gate-q">{ev.q}</div>
        <div className="ex-gate-opts">{ev.options.map((o,i)=><button key={i} disabled={done} className={`rp-quiz-opt ${done&&i===ev.answer?'right':''} ${done&&i===choice&&!ok?'wrong':''}`} onClick={()=>{onAnswer(ev,i);setChoice(i);}}><b>{'ABC'[i]}</b>{o}</button>)}</div>
        {done&&<div className="slidein" style={{marginTop:10}}>
          <div style={{fontWeight:800,lineHeight:1.6}}>{ok?'✅ 答对了！🪙 +10　':'❌ 差一点！　'}{ev.explain}</div>
          {getCard(ev.cardId)&&<div style={{marginTop:8}}><KnowledgeCard card={ev.cardId} compact/></div>}
          <button className="btn primary mt" onClick={()=>onGateDone(ev,choice)}>继续冒险 ▶</button>
        </div>}
      </div>
    </div>);}
  if(ev.type==='geo_fact')return (
    <div className="ex-toast slidein" onClick={onDone}><div className="kicker">🌍 真实世界的地理 · 新知识卡</div><KnowledgeCard card={ev.cardId} compact isNew/><div className="ex-get-hint" style={{color:'#111'}}>点一下收起</div></div>);
  if(ev.type==='complete')return (
    <div className="ex-ov ex-get">
      <div className="ex-get-burst"/>
      <div className="ex-get-sfx">COMPLETE！</div>
      <div className="ex-get-name">{region.name} 探索完成！</div>
      <div className="bubble ex-get-text">这里的陀螺都找到了，陀螺手也都见过了！下一个地区在等着你。</div>
      <div className="row center" style={{gap:12,marginTop:16}} onClick={e=>e.stopPropagation()}>{prototypeOf(region.id)&&<button className="btn yellow big" onClick={onArchive}>📜 揭晓真实原型！</button>}<button className="btn primary big" onClick={()=>go('map')}>回到世界地图</button><button className="btn big" onClick={onDone}>再看看</button></div>
    </div>);
  return null;
}
