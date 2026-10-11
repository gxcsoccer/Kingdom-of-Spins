import {useEffect,useMemo,useRef,useState} from 'react';
import {useGame,bladerById} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {WIN_POINTS,FINISH_LABEL,FINISH_ZH} from '../game/story.js';
import {createBattle} from '../game/battlePlayer.js';
import {commentary} from '../ai/client.js';
import {getCard} from '../knowledge/cards.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import BattleScene from '../scene/BattleScene.jsx';
import BeyArt from './BeyArt.jsx';
import {Portrait,Modal,TypeBadge} from './common.jsx';
import {DoctorFace} from './MapScreen.jsx';
import LaunchGauge from './LaunchGauge.jsx';
import RpmChart from './RpmChart.jsx';
import ExperimentLab from '../lab/ExperimentLab.jsx';
import {findMoments} from '../game/moments.js';
import * as aiClient from '../ai/client.js';
import ReplaySlot from './ReplaySlot.jsx';
import './battle.css';
import * as sfx from '../game/sfx.js';

import {STYLES,cpuLaunch,playerLaunch} from '../game/launch.js';
export {STYLES,cpuLaunch,playerLaunch};
const PREDICT=[{id:'ko',label:'把对手撞出界（OVER / XTREME）',match:r=>r==='over'||r==='xtreme'},{id:'spin',label:'比谁转得久（SPIN / 判定）',match:r=>r==='spin'||r==='judge'},{id:'lose',label:'我觉得会输……',match:null}];
const REWARD={normal:[120,60],pro:[160,80],super:[220,100],boss:[400,150]};

export default function BattleScreen(){
  const {save,params,go,recordMatch,unlockCards,recruit,addCoins}=useGame();
  const blader=params.bladerId?bladerById(params.bladerId):null;
  const opp=useMemo(()=>blader?{name:blader.name,bey:blader.bey,launch:blader.launch,color:blader.color,blader}:{name:'CPU',bey:params.oppBey||BEYS.titan,launch:{rpm:4900,tilt:4,speed:.35,aim:.5},color:'#8d99a6'},[blader,params.oppBey]);
  const target=save.demo?2:(params.points||WIN_POINTS);
  const myName=save.profile?.nickname||'你';

  const [beyUid,setBeyUid]=useState(params.beyUid||save.collection[0]?.uid);
  const myBey=save.collection.find(b=>b.uid===beyUid)||save.collection[0];
  const [style,setStyle]=useState('charge');
  const [prediction,setPrediction]=useState(null);
  const [phase,setPhase]=useState('prep'); // prep | countdown | fight | roundEnd | result
  const [player,setPlayer]=useState(null);
  const [score,setScore]=useState([0,0]);
  const [rounds,setRounds]=useState([]);
  const [count,setCount]=useState(3);
  const [experiment,setExperiment]=useState(null); // {launches, prev}
  const [speed,setSpeed]=useState(1);
  const [paused,setPaused]=useState(false);
  const roundRef=useRef(0);

  useEffect(()=>()=>{player?.dispose();sfx.spinHum(false);},[player]);
  const [muted,setMutedState]=useState(sfx.isMuted());

  const shoot=(power)=>{
    const round=++roundRef.current;
    const launches=experiment?.launches||[playerLaunch(style,power,round),cpuLaunch(opp.launch,`${opp.name}-${save.battles}-${round}`)];
    const p=createBattle({beys:[myBey,opp.bey],launches});
    p.meta={round,launches,beyName:myBey.name,experiment:!!experiment};
    setPlayer(p);setPhase('countdown');setCount(3);setPaused(false);setSpeed(1);
    p.onEvent(e=>{if(e.type==='collision')sfx.clang(e.intensity);if(e.type==='dash')sfx.whoosh();if(e.type==='finish'){sfx.spinHum(false);sfx.fanfare(e.winner===0);}});
    sfx.beep();sfx.say('3');
    let c=3;const iv=setInterval(()=>{c--;setCount(c);if(c>0){sfx.beep();sfx.say(String(c));}if(c===0){sfx.beep(true);sfx.say('Go shoot!');sfx.whoosh();}if(c<0){clearInterval(iv);p.start();sfx.spinHum(true);setPhase('fight');}},650);
  };

  // Detect end of playback.
  useEffect(()=>{
    if(phase!=='fight'||!player)return;
    let raf;const tick=()=>{player.getTime();if(player.finished){
      const res=player.result, pts=res.points;
      const next=[...score];next[res.winner]+=pts;
      setScore(next);
      setRounds(r=>[...r,{...player.meta,result:res,summary:player.summary,samples:player.samples,events:player.events}]);
      setTimeout(()=>setPhase(next[0]>=target||next[1]>=target?'result':'roundEnd'),2600);
      return;}raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[phase,player]);// eslint-disable-line

  const won=score[0]>=target;
  const onPrep=phase==='prep'||phase==='roundEnd';

  return (
    <div className="page dark battle-page">
      <Hud player={player} names={[myName,opp.name]} beys={[myBey,opp.bey]} score={score} target={target} color={opp.color} round={roundRef.current}/>
      <div className="battle-stage">
        {player?<BattleScene player={player} style={{position:'absolute',inset:0}}/>:<div className="battle-idle"><BeyArt bey={myBey} size={220} spin/><span className="h-display h-outline" style={{fontSize:80}}>VS</span><BeyArt bey={opp.bey} size={220} spin/></div>}
        {phase==='countdown'&&<div className="countdown"><span key={count} className="sfx pop">{count>0?count:'GO SHOOT!'}</span></div>}
        {phase==='fight'&&<div className="fight-controls">
          <button className="btn small" onClick={()=>{player.setPaused(!paused);setPaused(!paused);}}>{paused?'▶ 继续':'⏸ 暂停'}</button>
          {[1,2,4].map(s=><button key={s} className={`btn small ${speed===s?'yellow':''}`} onClick={()=>{player.setSpeed(s);setSpeed(s);}}>{s}×</button>)}
          <button className="btn small" onClick={()=>{sfx.setMuted(!muted);setMutedState(!muted);}}>{muted?'🔇':'🔊'}</button>
          <span className="model-note" style={{color:'#bbb'}}>模型结果 · MuJoCo 4 kHz</span>
        </div>}
        {onPrep&&<PrepPanel {...{save,myBey,setBeyUid,style,setStyle,prediction,setPrediction,shoot,opp,experiment,first:phase==='prep'&&!rounds.length,lastRound:rounds.at(-1),myName}}/>}
      </div>
      {phase==='result'&&<ResultPanel {...{won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,addCoins,
        }}/>}
    </div>
  );
}

function Hud({player,names,beys,score,target,color,round}){
  const [st,setSt]=useState(null);
  useEffect(()=>{if(!player)return;let raf;const f=()=>{const cur=player.getState(player.clock);setSt(cur);if(cur&&!player.paused)sfx.spinRpm(cur.bodies[0]?.rpm,cur.bodies[1]?.rpm);raf=requestAnimationFrame(f);};f();return()=>cancelAnimationFrame(raf);},[player]);
  const side=(i)=>{const b=st?.bodies?.[i],rpm=Math.max(0,Math.abs(b?.rpm||0));return (
    <div className={`hud-side ${i?'right':''}`} style={{background:i?color:beys[0].colors?.primary}}>
      <div className="row between"><span className="hud-name">{names[i]} · {beys[i].name}</span><span className="hud-pts">{score[i]} PT</span></div>
      <div className="hud-bar"><i style={{width:`${Math.min(100,rpm/70)}%`,background:rpm<1200?'var(--red)':'var(--yellow)'}}/></div>
      <div className="hud-meta">{Math.round(rpm).toLocaleString()} RPM · 倾角 {Math.round(b?.tilt||0)}°</div>
    </div>);};
  return (
    <div className="hud">
      {side(0)}
      <div className="hud-mid"><div>ROUND {Math.max(1,round)}</div><div className="hud-time">{(st?.time||0).toFixed(1)}s</div><div className="hud-target">先拿 {target} 分</div></div>
      {side(1)}
    </div>
  );
}

function PrepPanel({save,myBey,setBeyUid,style,setStyle,prediction,setPrediction,shoot,opp,experiment,first,lastRound,myName}){
  return (
    <div className="prep slidein">
      {lastRound&&<div className="prep-last">上一回合：<b>{FINISH_LABEL[lastRound.result.reason]}</b>（{FINISH_ZH[lastRound.result.reason]}）· {lastRound.result.winner?opp.name:myName} +{lastRound.result.points} 分</div>}
      {experiment&&<div className="prep-exp">🔬 实验模式：发射条件和对手完全不变，只换你的陀螺或零件，看看结果会不会变。</div>}
      <div className="prep-grid">
        <div className="panel prep-col">
          <div className="prep-h">① 出战陀螺</div>
          <div className="col" style={{gap:8,maxHeight:220,overflowY:'auto'}}>
            {save.collection.map(b=><button key={b.uid} className={`prep-bey ${b.uid===myBey.uid?'on':''}`} onClick={()=>setBeyUid(b.uid)}><BeyArt bey={b} size={44}/><span><b>{b.name}</b><br/><small>{b.ratchet?.prongs||3}-{b.ratchet?.height||60} {b.bit}</small></span><TypeBadge type={b.type||b.blade?.style}/></button>)}
          </div>
          {!experiment&&<><div className="prep-h mt">② 发射方式</div>
          <div className="row wrap" style={{gap:8}}>{Object.entries(STYLES).map(([k,s])=><button key={k} className={`chip ${style===k?'on':''}`} onClick={()=>setStyle(k)} title={s.desc}>{s.label}</button>)}</div>
          <div className="muted" style={{fontSize:12,marginTop:6,color:'#555'}}>{STYLES[style].desc}（真实的初速度方向和倾角）</div></>}
        </div>
        <div className="panel prep-col" style={{alignItems:'center'}}>
          <div className="prep-h" style={{alignSelf:'flex-start'}}>③ 发射！</div>
          {experiment?<button className="btn primary big" onClick={()=>shoot(0)}>同样条件 · GO SHOOT!</button>:<LaunchGauge onShoot={shoot}/>}
        </div>
        {first&&!experiment&&<div className="panel ink prep-col">
          <div className="prep-h" style={{color:'var(--yellow)'}}>④ 先预测一下（可跳过）</div>
          <div className="row" style={{alignItems:'flex-start',gap:10}}><DoctorFace size={56}/><div className="bubble" style={{color:'#111',fontSize:14}}>{opp.name}用的是 {opp.bey.name}。你觉得你会怎么赢？</div></div>
          <div className="col mt" style={{gap:8}}>{PREDICT.map(p=><button key={p.id} className={`btn small ${prediction===p.id?'primary':''}`} style={{justifyContent:'flex-start'}} onClick={()=>setPrediction(p.id)}>{p.label}</button>)}</div>
        </div>}
      </div>
    </div>
  );
}

const MOMENT_TITLE={'first-hit':'第一次碰撞','big-hit':'最猛的一撞','spin-drop':'转速大跳水','dash':'冲刺！','finish':'决胜时刻'};
function localMoment(m,names){
  const n=i=>i===0?`你的 ${names[0]}`:names[1];const d=m.data||{};
  if(m.kind==='first-hit'||m.kind==='big-hit')return `相对速度 ${(d.relSpeed||0).toFixed(1)} m/s 的碰撞。撞完 ${n(0)} 约 ${Math.round((d.rpmAfter?.[0]||0)/100)*100} 转、${n(1)} 约 ${Math.round((d.rpmAfter?.[1]||0)/100)*100} 转——撞击会把转动的能量变成乱跑和晃动。`;
  if(m.kind==='spin-drop')return `1 秒内 ${n(m.body)} 的转速掉了约 ${Math.round((d.drop||0)/100)*100} 转。看看这一秒它撞到了什么？`;
  if(m.kind==='finish')return `${n(1-d.winner)} ${({spin:'先停转了',over:'飞出了场地',xtreme:'掉进了 Xtreme 口',judge:'时间到时转速更低'})[d.reason]||''}。`;
  return '';
}
function suggestVariable(bey,won){
  if(!won&&(bey.bit==='flat'||bey.bit==='rush'))return {key:'bit',value:'ball'};
  if(bey.bit==='needle')return {key:'bit',value:'ball'};
  if((bey.blade?.ring??60)<70)return {key:'ring',value:80};
  return {key:'bit',value:'needle'};
}

function ResultPanel({won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,addCoins}){
  const [ai,setAi]=useState(null);
  const [recruitOpen,setRecruitOpen]=useState(false);
  const [active,setActive]=useState(null);
  const [cursor,setCursor]=useState(null);
  const viewer=useRef(null);
  const decisive=rounds.at(-1);
  const names=[myBey.name,opp.bey.name];
  const moments=useMemo(()=>findMoments(decisive.samples,decisive.events,decisive.result),[decisive]);
  const pred=PREDICT.find(p=>p.id===prediction);
  const predOk=pred&&(won?pred.match?.(decisive.result.reason):pred.id==='lose');
  const tier=blader?.tier;
  const [first]=useState(()=>!!blader&&!save.defeated.includes(blader.id));
  const coins=won?(REWARD[tier]||[80,40])[first?0:1]+(predOk?20:0):20;
  const done=useRef(false);
  const [canRecruit]=useState(()=>won&&tier==='pro'&&!save.team.some(t=>t.bladerId===blader.id));
  useEffect(()=>{
    if(done.current)return;done.current=true;
    recordMatch({bladerId:won?blader?.id:null,won,coins,prediction:pred?{id:pred.id,correct:!!predOk,opp:opp.name}:null});
    const req=aiClient.moments?aiClient.moments({summary:decisive.summary,moments,names}):commentary(decisive.summary,names);
    Promise.resolve(req).then(r=>{setAi(r||{});const ids=(r?.moments||[]).map(m=>m.cardId).concat(r?.science?.cardId||[]).filter(Boolean);if(ids.length)unlockCards(ids);}).catch(()=>setAi({}));
    if(canRecruit)setTimeout(()=>setRecruitOpen(true),900);
  },[]);// eslint-disable-line
  const aiM=id=>(ai?.moments||[]).find(m=>m.id===id);
  const play=m=>{setActive(m.id+':'+Date.now());viewer.current?.playMoment?.(m.id);};
  return (
    <div className="result slidein">
      <div className="row wrap" style={{gap:24,alignItems:'center'}}>
        <div className={`h-display ${won?'h-red':'h-outline'}`} style={{fontSize:'clamp(56px,8vw,96px)',transform:'rotate(-4deg)'}}>{won?'VICTORY!':'DEFEAT…'}</div>
        <div>
          <div style={{fontWeight:900,fontSize:22}}>{score[0]} : {score[1]} · 决胜：{FINISH_LABEL[decisive.result.reason]}（{FINISH_ZH[decisive.result.reason]}）</div>
          <div style={{marginTop:4,fontWeight:700}}>奖励：🪙 +{coins}{first&&won?' · 首次击败！':''}{pred?` · 预测：${predOk?'猜对了 ✓':'没猜中'}`:''}</div>
        </div>
      </div>

      <section className="review mt">
        <div className="review-head"><DoctorFace mood={ai?'excited':'thinking'} size={56}/><div><div className="h-display" style={{fontSize:26}}>复盘 · {ai?.headline||'关键时刻'}</div><div className="muted" style={{color:'#bbb',fontWeight:700}}>点一个关键时刻，慢动作回看发生了什么</div></div></div>
        <div className="review-grid">
          <div className="review-stage">
            <ReplaySlot ref={viewer} beys={[myBey,opp.bey]} samples={decisive.samples} events={decisive.events} moments={moments.map(m=>({id:m.id,time:m.time,title:aiM(m.id)?.title||MOMENT_TITLE[m.kind]}))} activeMoment={active} onSeek={setCursor}/>
            <div className="panel" style={{padding:12,color:'#111',marginTop:12}}><b>📈 转速曲线（点图表跳到那一刻）</b>
              <RpmChart samples={decisive.samples} events={decisive.events} moments={moments} cursor={cursor} onSeek={t=>{setCursor(t);viewer.current?.seek?.(t);}} names={names} colors={[myBey.colors?.primary||'#2f7bff',opp.bey.colors?.primary||'#f2b632']}/>
            </div>
          </div>
          <div className="moment-list">
            {moments.map(m=>{const a=aiM(m.id);const card=a?.cardId&&getCard(a.cardId);return (
              <div key={m.id} className={`moment ${active?.startsWith(m.id+':')?'on':''}`}>
                <button className="moment-hit" onClick={()=>play(m)}>
                  <span className="moment-n">{'①②③④'[m.n-1]}</span>
                  <span className="grow"><b>{a?.title||MOMENT_TITLE[m.kind]}</b><small>{m.time.toFixed(1)} 秒</small></span>
                  <span className="moment-play">▶ 回放</span>
                </button>
                <p>{ai?(a?.explain||localMoment(m,names)):'博士正在看这一段……'}</p>
                {card&&<KnowledgeChip card={card}/>}
              </div>);})}
            {ai?.takeaway&&<div className="takeaway">💡 {ai.takeaway}</div>}
            <div className="model-note" style={{color:'#aaa'}}>复盘只引用这一局记录到的数据；因果结论都是「在这个模型里」成立。</div>
          </div>
        </div>
      </section>

      <div className="mt2"><ExperimentLab mine={myBey} opp={opp.bey} launches={decisive.launches} names={names} suggest={suggestVariable(myBey,won)} onReward={n=>addCoins(n)} onUnlock={unlockCards}/></div>

      <div className="row mt2" style={{gap:10,maxWidth:720}}>
        <button className="btn primary grow" onClick={()=>go('map')}>回到地图</button>
        <button className="btn grow" onClick={()=>go('battle',{...useGame.getState().params})}>再战一次</button>
        <button className="btn grow" onClick={()=>go('fusion',{back:'map'})}>去融合工坊改造</button>
      </div>
      {recruitOpen&&<RecruitModal blader={blader} save={save} onDone={(uid)=>{recruit(blader.id,uid);setRecruitOpen(false);}} onClose={()=>setRecruitOpen(false)}/>}
    </div>
  );
}

function ExperimentCompare({rounds,myName,opp}){
  const r=rounds.at(-1);
  return <div className="panel" style={{padding:14,color:'#111'}}>
    <b>🔬 实验记录</b>
    <div style={{fontSize:14,lineHeight:1.7,marginTop:6}}>这次用 <b>{r.beyName}</b>：{r.result.winner?opp.name:myName} 以 {FINISH_ZH[r.result.reason]} 获胜，用时 {r.result.time.toFixed(1)} 秒。<br/>发射条件和对手完全一样，所以差别来自你换的东西（在这个模型里）。</div>
  </div>;
}

function RecruitModal({blader,save,onDone,onClose}){
  const [pick,setPick]=useState(null);
  const used=new Set(save.team.map(t=>t.beyUid));
  return <Modal onClose={onClose}>
    <div className="row" style={{gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div style={{border:'var(--border-thick)'}}><Portrait blader={blader} size={150}/></div>
      <div className="col grow">
        <div className="sfx" style={{fontSize:40,color:'var(--yellow)'}}>招募！</div>
        <div className="bubble">「你很强！让我加入你的队伍吧。能借我一只陀螺吗？」——{blader.name}</div>
      </div>
    </div>
    <div className="prep-h mt2">选一只陀螺装备给 {blader.name}（它仍然留在你的收藏里）</div>
    <div className="grid mt" style={{gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>
      {save.collection.map(b=><button key={b.uid} disabled={used.has(b.uid)} className={`prep-bey ${pick===b.uid?'on':''}`} style={{flexDirection:'column'}} onClick={()=>setPick(b.uid)}><BeyArt bey={b} size={70}/><b>{b.name}</b>{used.has(b.uid)&&<small>已被队员使用</small>}</button>)}
    </div>
    <div className="row mt2" style={{justifyContent:'flex-end'}}><button className="btn" onClick={onClose}>以后再说</button><button className="btn primary" disabled={!pick} onClick={()=>onDone(pick)}>欢迎加入！</button></div>
  </Modal>;
}
