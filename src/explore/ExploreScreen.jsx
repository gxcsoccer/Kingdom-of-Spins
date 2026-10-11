import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useGame} from '../game/store.js';
import {regionById,emptyExplore} from '../game/regions.js';
import {BEYS} from '../game/beys.js';
import {BLADERS} from '../game/story.js';
import {getCard} from '../knowledge/cards.js';
import KnowledgeCard from '../knowledge/KnowledgeCard.jsx';
import {SCENES,sceneUrl,sceneByKey,START_SCENE} from '../game/scenes.js';
import {openTargets,questClue,heat,targetName,compass,DIR_ARROW} from './quest.js';
import MiniMap from './MiniMap.jsx';
import {speak,stopSpeaking,ttsSupported} from '../fusion/voice.js';
import BeyArt from '../ui/BeyArt.jsx';
import {Portrait} from '../ui/common.jsx';
import * as sfx from '../game/sfx.js';
import {getSeen,markSeen} from '../knowledge/quizSeen.js';
import ProtoArchive from './ProtoArchive.jsx';
import {prototypeOf} from '../game/prototypes.js';
import '../flipbook/flipbook.css';
import '../ui/result/result.css';
import './explore.css';

const bladerById=id=>BLADERS.find(b=>b.id===id);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const MAX_TRAIL=40;

// Per-run hiding plan (code decides; different every run): each remaining item → a distinct non-start scene + spot.
function makePlan(region,found,met){
  const scenes=shuffle((SCENES[region.id]||[]).filter(s=>s.key!==START_SCENE[region.id]));
  const items=shuffle([...region.beys.filter(id=>!found.includes(id)).map(id=>({type:'bey',id})),...region.bladers.filter(id=>!met.includes(id)).map(id=>({type:'blader',id}))]);
  return items.map((it,i)=>{const sc=scenes[i%scenes.length];return {...it,scene:sc.key,spot:Math.floor(Math.random()*sc.spots.length)};});
}
const pageFor=(regionId,key)=>{const sc=sceneByKey(regionId,key);return {id:`${key}-${Date.now().toString(36)}`,sceneKey:key,title:sc?.title||key,panels:[],line:'',
  hotspots:(sc?.spots||[]).map((p,i)=>({...p,spot:i})),exits:(sc?.exits||[]).map(k=>({key:k,title:sceneByKey(regionId,k)?.title||k}))};};

function SceneImage({regionId,page}){
  const srcs=[page.sceneKey&&sceneUrl(regionId,page.sceneKey),`/art/regions/${regionId}.jpg`].filter(Boolean);
  const [i,setI]=useState(0);
  useEffect(()=>setI(0),[page.sceneKey]);
  if(i<srcs.length)return <img key={srcs[i]} src={srcs[i]} alt="" draggable={false} onError={()=>setI(n=>n+1)}/>;
  return <div className="ex-sketch"><span>{page.title}</span></div>;
}
function TypeLine({text}){
  const [n,setN]=useState(0);
  useEffect(()=>{setN(0);if(!text)return;const t=setInterval(()=>setN(k=>{if(k>=text.length){clearInterval(t);return k;}return k+1;}),35);return()=>clearInterval(t);},[text]);
  return <>{text.slice(0,n)}<span className="ex-caret">{n<text.length?'▍':''}</span></>;
}
async function flavor(body){
  try{const r=await fetch('/api/ai/explore/flavor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return await r.json();}catch{return null;}
}

/** 寻宝游戏：代码决定藏宝点、线索和冷热，AI 只写旁白。params: {regionId} */
export default function ExploreScreen(){
  const {params,save,go,updateExplore,findBey,meetBlader,unlockCards,addCoins}=useGame();
  const region=regionById(params.regionId)||regionById('harbor');
  const ex=save.explore?.[region.id]||emptyExplore();
  const gm=ex.gm&&ex.gm.v===2?ex.gm:null;
  const [queue,setQueue]=useState([]);
  const [chip,setChip]=useState(null);           // {kind:'heat'|'alt', level, text, key}
  const [writing,setWriting]=useState(false);
  const [voice,setVoice]=useState(false);
  const [archive,setArchive]=useState(false);
  const [viewIdx,setViewIdx]=useState(null);     // filmstrip browsing (null = live)
  const blocking=queue.some(e=>e.type!=='geo_fact');   // knowledge toasts never block play
  const alive=useRef(true);
  useEffect(()=>()=>{alive.current=false;stopSpeaking();},[]);

  const upd=fn=>updateExplore(region.id,x=>{x.gm=x.gm&&x.gm.v===2?x.gm:{v:2};fn(x.gm,x);});
  const G=()=>{const e=useGame.getState().save.explore?.[region.id]||emptyExplore();return {e,g:e.gm&&e.gm.v===2?e.gm:{v:2}};};

  // Start a run (first visit, legacy save, or "新的探险").
  const startRun=useCallback(()=>{
    const {e}=G(),start=START_SCENE[region.id];
    const page=pageFor(region.id,start);
    updateExplore(region.id,x=>{x.runs=(x.runs||0)+1;x.steps=0;x.gm={v:2,scene:start,visited:[start],hidePlan:makePlan(region,x.found||[],x.met||[]),hint:{},tries:{},trail:[page],done:[],memory:'',narration:'看小地图右上角的指南针，上面是北！',sinceGate:0,sinceFind:0,pendingGate:null};});
    setQueue([]);setViewIdx(null);
    writeFlavor({type:'enter'},{type:'arrive'},page.id,{firstRun:(e.runs||0)===0});
  },[region.id]);// eslint-disable-line
  const started=useRef(false);
  useEffect(()=>{if(started.current||region.comingSoon)return;started.current=true;
    if(!gm?.trail?.length)startRun();else if(gm.pendingGate)addEvents([{type:'gate',...gm.pendingGate}]);},[]);// eslint-disable-line

  const here=gm?.scene||START_SCENE[region.id];
  const targets=useMemo(()=>gm?openTargets(region.id,gm.hidePlan||[],ex.found,ex.met,here):[],[gm,ex.found,ex.met,here,region.id]);
  const target=targets[0]||null;
  const hintLevel=target?Math.min(2,gm?.hint?.[target.id]||0):0;
  const clue=target?questClue(region.id,target,here,hintLevel):null;
  const trail=gm?.trail||[];
  const live=trail[trail.length-1];
  const view=viewIdx!=null?trail[viewIdx]:live;
  const totalTasks=region.beys.length+region.bladers.length,doneTasks=ex.found.filter(id=>region.beys.includes(id)).length+ex.met.filter(id=>region.bladers.includes(id)).length;
  const complete=doneTasks>=totalTasks;
  useEffect(()=>{if(voice&&gm?.narration)speak(gm.narration);},[gm?.narration,voice]);

  // GM flavour in the background — never blocks the UI.
  function writeFlavor(action,outcome,pageId,extra={}){
    const {g}=G();setWriting(true);
    const t=openTargets(region.id,g.hidePlan||[],G().e.found,G().e.met,g.scene)[0];
    flavor({regionId:region.id,scene:G().g.scene,action,outcome,clue:t?questClue(region.id,t,G().g.scene,0)?.text:'',memory:g.memory,sinceGate:g.sinceGate||0,quizSeen:getSeen().slice(-120),...extra}).then(r=>{
      if(!alive.current)return;setWriting(false);if(!r)return;
      upd(gg=>{const p=(gg.trail||[]).find(p=>p.id===pageId);if(p){if(action.type!=='inspect'&&r.title)p.title=r.title;if(r.panel&&action.type!=='inspect')p.panels=[{text:r.panel,kind:'caption'}];if(action.type==='inspect'&&r.line)p.line=r.line;}
        if(r.narration)gg.narration=r.narration;gg.memory=r.gmMemory||gg.memory;
        const gate=(r.events||[]).find(e=>e.type==='gate');if(gate){gg.pendingGate={quizId:gate.quizId,lead:gate.lead,q:gate.q,answer:gate.answer,explain:gate.explain,options:gate.options,cardId:gate.cardId};gg.sinceGate=0;}});
      // 已经拿到过的地理卡不再弹（AI 常常每一步都推同一张“越高越冷”）。
      const owned=useGame.getState().save.cards||[];
      const evs=(r.events||[]).filter(e=>e.type==='gate'||(e.type==='geo_fact'&&!owned.includes(e.cardId)));if(evs.length)setQueue(q=>[...q,...evs.filter(e=>e.type!=='geo_fact'||!q.some(x=>x.cardId===e.cardId)).map(e=>({...e,qid:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`}))]);
    });
  }
  function flash(c){const key=Date.now();setChip({...c,key});setTimeout(()=>alive.current&&setChip(ch=>ch?.key===key?null:ch),2600);}

  function moveTo(key){
    if(!gm||blocking||key===here)return;
    const sc=sceneByKey(region.id,here),dest=sceneByKey(region.id,key);
    if(!dest||!(sc?.exits.includes(key)||(gm.visited||[]).includes(key)))return;
    const page=pageFor(region.id,key),from=here;
    upd((g,x)=>{g.scene=key;g.visited=[...new Set([...(g.visited||[]),key])];g.trail=[...(g.trail||[]),page].slice(-MAX_TRAIL);g.sinceFind=(g.sinceFind||0)+1;g.sinceGate=(g.sinceGate||0)+1;x.steps=(x.steps||0)+1;
      const t=openTargets(region.id,g.hidePlan||[],x.found,x.met,key)[0];if(t&&g.sinceFind>=8)g.hint={...(g.hint||{}),[t.id]:2};});
    setViewIdx(null);sfx.beep?.();
    if(sc?.alt&&dest.alt&&sc.alt!==dest.alt){const d=dest.alt-sc.alt,dt=-(d*.6/100);
      flash({kind:'alt',text:`海拔 ${sc.alt} → ${dest.alt} 米，${d>0?'更冷了 ❄️':'暖和了 ☀️'} 约 ${dt>0?'+':''}${dt.toFixed(1)}°C`});}
    writeFlavor({type:'move',from},{type:'arrive'},page.id);
  }

  function inspect(spot){
    if(!gm||blocking)return;
    const sc=sceneByKey(region.id,here);const label=sc?.spots[spot]?.label;
    // Any open target hidden at exactly this scene+spot is found (not only the current one).
    const hit=targets.find(t=>t.scene===here&&t.spot===spot);
    if(hit){
      const name=targetName(hit);
      upd((g,x)=>{g.done=[...(g.done||[]),{id:hit.id,type:hit.type,name,where:sc.title}];g.sinceFind=0;});
      const left=targets.length-1;
      addEvents([hit.type==='bey'?{type:'find_bey',beyId:hit.id,text:`就在「${label}」里！`}:{type:'meet_blader',bladerId:hit.id,line:bladerById(hit.id)?.line},...(left===0?[{type:'complete'}]:[])]);
      writeFlavor({type:'inspect',spot},{type:'found',id:hit.id,name},live.id);
      return;
    }
    const h=heat(region.id,target,here,spot);
    upd(g=>{g.sinceFind=(g.sinceFind||0)+1;g.sinceGate=(g.sinceGate||0)+1;
      if(target&&here===target.scene){g.tries={...(g.tries||{}),[target.id]:((g.tries||{})[target.id]||0)+1};if(g.tries[target.id]>=3&&(g.hint?.[target.id]||0)<1)g.hint={...(g.hint||{}),[target.id]:1};}
      if(target&&g.sinceFind>=8)g.hint={...(g.hint||{}),[target.id]:2};
      const p=(g.trail||[]).at(-1);if(p){p.tapped=label;p.line='';}});
    if(h)flash({kind:'heat',level:h.level,text:`「${label}」：${h.text}`});
    sfx.beep?.(h?.level==='hot');
    writeFlavor({type:'inspect',spot},{type:'heat',level:h?.level},live.id);
  }
  function onImageTap(ev){
    if(viewIdx!=null){setViewIdx(null);return;}
    if(!view)return;
    const r=ev.currentTarget.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;
    let best=0,d=9;view.hotspots.forEach((h,i)=>{const e=Math.hypot(h.x-x,h.y-y);if(e<d){d=e;best=i;}});
    inspect(best);
  }
  // 每个事件带唯一 qid：弹层按 qid 关闭，不会因为两条内容一样的事件而关不掉或多关一条。
  const addEvents=evs=>setQueue(q=>[...q,...evs.map(e=>({...e,qid:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`}))]);
  const drop=qid=>setQueue(q=>q.filter(e=>e.qid!==qid));
  // 知识卡是不挡路的小提示，和“找到了 / 遇见了 / 小考验”这些弹层分开显示。
  const ev0=queue.find(e=>e.type!=='geo_fact'),toast=queue.find(e=>e.type==='geo_fact');
  const pop=()=>ev0&&drop(ev0.qid);

  if(region.comingSoon)return <div className="page dark ex-soon"><div className="panel" style={{padding:30,color:'#111',textAlign:'center'}}><div className="sfx" style={{fontSize:56}}>即将开放！</div><p style={{fontWeight:800}}>{region.name}（{region.landform}）还在建造中，敬请期待～</p><button className="btn primary big" onClick={()=>go('map')}>回到地图</button></div></div>;

  const found=new Set(ex.found),met=new Set(ex.met);
  return (
    <div className="ex ex2 page dark" style={{'--rc':region.color}}>
      <div className="ex-main">
        <div className="ex-top">
          <button className="btn small" onClick={()=>go('map')}>◀ 地图</button>
          <div className="ex-region"><span className="kicker" style={{color:'var(--rc)'}}>{region.en}</span><b>{region.name}</b><small>{region.landform}</small></div>
          <div className="row" style={{gap:8}}>
            {ttsSupported&&<button className="btn small" onClick={()=>setVoice(v=>{if(v)stopSpeaking();return !v;})}>{voice?'🔊':'🔈'} 朗读</button>}
            <button className="btn small" onClick={()=>{if(confirm('重新开始这次寻宝？已经找到的陀螺和遇见的人会保留。'))startRun();}}>🔄 新的寻宝</button>
          </div>
        </div>
        <div className={`ex-quest-bar ${clue?.here?'here':''}`}>
          {complete?<><b className="ex-task">🎉 全部完成！</b><span className="ex-clue-text">这里的陀螺和陀螺手都找齐了。</span></>
            :clue?<><b className="ex-task">任务 {doneTasks+1}/{totalTasks}：{clue.title}</b>
              <span className="ex-clue-text">{clue.here?'📍 ':'🧭 '}{clue.text}</span>
              <button className="btn small yellow" disabled={hintLevel>=2} onClick={()=>upd(g=>{g.hint={...(g.hint||{}),[target.id]:Math.min(2,(g.hint?.[target.id]||0)+1)};})}>💡 博士提示{hintLevel?` ${hintLevel}/2`:''}</button></>
            :<span className="ex-clue-text">准备中…</span>}
        </div>
        <div className="ex-stage">
          {view&&<div className="fb-page ex-page" key={view.id}>
            <div className="ex-title-row"><h2>{view.title}</h2>{view.tapped&&viewIdx==null&&<span className="fb-tapped">👆 {view.tapped}</span>}</div>
            <div className="ex-caption">{viewIdx!=null?<span className="ex-past">（回看中 · 点画面回到现在）</span>:view.line?<span>💬 {view.line}</span>:view.panels[0]?<TypeLine text={view.panels[0].text}/>:<span className="ex-writing">{writing?'✍️ 博士在写这里的故事…':'点画里的东西，仔细找找！'}</span>}</div>
            <div className="fb-art ex-art" onClick={onImageTap}>
              <SceneImage regionId={region.id} page={view}/>
              {viewIdx==null&&view.hotspots.map((h,i)=><div key={i} title={h.label} className="fb-hot" style={{left:`${h.x*100}%`,top:`${h.y*100}%`,animationDelay:`${.2+i*.12}s`}}><i/><span>{h.label}</span></div>)}
              {chip&&<div key={chip.key} className={`ex-chip ${chip.kind} ${chip.level||''}`}>{chip.text}</div>}
            </div>
            {viewIdx==null&&<div className="ex-exits"><span className="ex-exits-l">走去：</span>{view.exits.map(x=><button key={x.key} className={`ex-exit ${clue&&!clue.here&&clue.next===x.key&&hintLevel>=1?'hint':''}`} disabled={blocking} onClick={()=>moveTo(x.key)}>{(()=>{const d=compass(region.id,here,x.key);return d?<><b className="ex-exit-dir">{DIR_ARROW[d]} {d}</b> </>:'→ ';})()}{x.title}</button>)}</div>}
          </div>}
        </div>
      </div>

      <aside className="ex-side">
        <div className="ex-guide"><span className="ex-guide-face">博士</span><div className="bubble"><TypeLine text={gm?.narration||'点画面里任何你好奇的地方！'}/></div></div>
        <MiniMap regionId={region.id} here={here} visited={gm?.visited||[]} hintScene={hintLevel>=2?target?.scene:null} onGo={moveTo}/>
        <div className="ex-quest">
          <div className="ex-h">🌀 陀螺 <small>{region.beys.filter(id=>found.has(id)).length}/{region.beys.length}</small></div>
          <div className="ex-items">{region.beys.map(id=><div key={id} className={`ex-item ${found.has(id)?'got':''} ${target?.id===id?'now':''}`} title={found.has(id)?BEYS[id]?.name:'？？？'}><BeyArt bey={BEYS[id]} size={44}/><span>{found.has(id)?BEYS[id]?.name:target?.id===id?'寻找中':'？？？'}</span></div>)}</div>
          <div className="ex-h">⚔️ 陀螺手 <small>{region.bladers.filter(id=>met.has(id)).length}/{region.bladers.length}</small></div>
          <div className="ex-items">{region.bladers.map(id=>{const b=bladerById(id);const m=met.has(id);return <button key={id} className={`ex-item ${m?'got':''} ${target?.id===id?'now':''}`} disabled={!m} title={m?`再挑战 ${b?.name}`:'？？？'} onClick={()=>m&&go('battle',{bladerId:id,from:'explore',regionId:region.id})}><Portrait blader={b} size={44}/><span>{m?b?.name:target?.id===id?'寻找中':'？？？'}</span></button>;})}</div>
          <div className="ex-steps">第 {ex.runs||1} 次寻宝 · 走了 {ex.steps||0} 步</div>
          {prototypeOf(region.id)&&<button className={`btn small ${complete?'yellow':''}`} style={{marginTop:6,width:'100%'}} disabled={!complete} onClick={()=>setArchive(true)}>{complete?'📜 真实原型档案':'📜 原型档案（全部完成后解锁）'}</button>}
        </div>
        {(gm?.done||[]).length>0&&<div className="ex-clues"><div className="ex-h">✅ 已完成任务</div>{gm.done.slice(-3).reverse().map((d,i)=><div key={i} className="ex-clue">{d.type==='bey'?'🌀':'⚔️'} {d.name} · {d.where}</div>)}</div>}
      </aside>

      {toast&&<GeoToast key={toast.qid} ev={toast} onGeo={id=>unlockCards([id])} onDone={()=>drop(toast.qid)}/>}
      {ev0&&<EventOverlay key={ev0.qid} ev={ev0} region={region}
        onFind={id=>{const b=findBey(region.id,id);sfx.beep?.(true);return b;}}
        onMeet={(id,fight)=>{meetBlader(region.id,id);pop();if(fight)go('battle',{bladerId:id,from:'explore',regionId:region.id});}}
        onGeo={id=>unlockCards([id])}
        onAnswer={(g,choice)=>{const ok=choice===g.answer;if(ok){addCoins(10);sfx.beep?.(true);}else sfx.beep?.();unlockCards([g.cardId]);return ok;}}
        onGateDone={()=>{pop();upd(g=>{g.pendingGate=null;});}}
        onDone={pop} go={go} onArchive={()=>{pop();setArchive(true);}}/>}
      {archive&&<ProtoArchive regionId={region.id} onClose={()=>setArchive(false)}/>}
    </div>
  );
}

function GeoToast({ev,onGeo,onDone}){
  useEffect(()=>{onGeo(ev.cardId);const t=setTimeout(onDone,9000);return()=>clearTimeout(t);},[]);// eslint-disable-line
  // 捕获阶段关闭：卡片里的按钮（翻开绘本等）不会吞掉这次点击。
  return <div className="ex-toast slidein" onClickCapture={onDone}><div className="kicker">🌍 真实世界的地理 · 新知识卡</div><KnowledgeCard card={ev.cardId} compact isNew/><div className="ex-get-hint" style={{color:'#111'}}>点一下收起</div></div>;
}
function EventOverlay({ev,region,onFind,onMeet,onGeo,onAnswer,onGateDone,onDone,go,onArchive}){
  const [choice,setChoice]=useState(null);
  const [got,setGot]=useState(null);
  useEffect(()=>{
    if(ev.type==='find_bey'){const b=onFind(ev.beyId);setGot(b||BEYS[ev.beyId]);}
    if(ev.type==='gate')markSeen(ev.quizId);
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
        <div className="ex-meet-text"><div className="kicker">ENCOUNTER</div><div className="ex-meet-name">{b?.name}</div><div className="ex-meet-line">「{String(ev.line||b?.line||'').replace(new RegExp(`^${b?.name||'^'}\\s*(说|喊|道)?\\s*[：:]\\s*`),'').replace(/^[「“"]+|[」”"]+$/g,'')}」</div></div></div>
      <div className="row center" style={{gap:16}}><button className="btn primary big" onClick={()=>onMeet(ev.bladerId,true)}>⚔️ 挑战！</button><button className="btn big" onClick={()=>onMeet(ev.bladerId,false)}>稍后再来</button></div>
      <div className="ex-get-hint">遇见过的陀螺手可以随时在右边的名单里再挑战</div>
    </div>);}
  if(ev.type==='gate'){const done=choice!=null;const ok=done&&choice===ev.answer;return (
    <div className="ex-ov ex-gate-wrap">
      <div className="panel ex-gate pop-in">
        <div className="kicker" style={{color:'var(--red)'}}>🚧 博士的小考验</div>
        {ev.lead&&<div className="ex-gate-lead">{ev.lead}</div>}
        <div className="ex-gate-q">{ev.q}</div>
        <div className="ex-gate-opts">{ev.options.map((o,i)=><button key={i} disabled={done} className={`rp-quiz-opt ${done&&i===ev.answer?'right':''} ${done&&i===choice&&!ok?'wrong':''}`} onClick={()=>{onAnswer(ev,i);setChoice(i);}}><b>{'ABC'[i]}</b>{o}</button>)}</div>
        {done&&<div className="slidein" style={{marginTop:10}}>
          <div style={{fontWeight:800,lineHeight:1.6}}>{ok?'✅ 答对了！🪙 +10　':'❌ 差一点！　'}{ev.explain}</div>
          {getCard(ev.cardId)&&<div style={{marginTop:8}}><KnowledgeCard card={ev.cardId} compact/></div>}
          <button className="btn primary mt" onClick={()=>onGateDone(ev,choice)}>继续寻宝 ▶</button>
        </div>}
      </div>
    </div>);}
  if(ev.type==='complete')return (
    <div className="ex-ov ex-get">
      <div className="ex-get-burst"/>
      <div className="ex-get-sfx">COMPLETE！</div>
      <div className="ex-get-name">{region.name} 寻宝完成！</div>
      <div className="bubble ex-get-text">这里的陀螺都找到了，陀螺手也都见过了！下一个地区在等着你。</div>
      <div className="row center" style={{gap:12,marginTop:16}} onClick={e=>e.stopPropagation()}>{prototypeOf(region.id)&&<button className="btn yellow big" onClick={onArchive}>📜 揭晓真实原型！</button>}<button className="btn primary big" onClick={()=>go('map')}>回到世界地图</button><button className="btn big" onClick={onDone}>再看看</button></div>
    </div>);
  return null;
}
