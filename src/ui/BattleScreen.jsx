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
import './battle.css';

import {STYLES,cpuLaunch,playerLaunch} from '../game/launch.js';
export {STYLES,cpuLaunch,playerLaunch};
const PREDICT=[{id:'ko',label:'把对手撞出界（OVER / XTREME）',match:r=>r==='over'||r==='xtreme'},{id:'spin',label:'比谁转得久（SPIN / 判定）',match:r=>r==='spin'||r==='judge'},{id:'lose',label:'我觉得会输……',match:null}];
const REWARD={normal:[120,60],pro:[160,80],super:[220,100],boss:[400,150]};

export default function BattleScreen(){
  const {save,params,go,recordMatch,unlockCards,recruit}=useGame();
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

  useEffect(()=>()=>player?.dispose(),[player]);

  const shoot=(power)=>{
    const round=++roundRef.current;
    const launches=experiment?.launches||[playerLaunch(style,power,round),cpuLaunch(opp.launch,`${opp.name}-${save.battles}-${round}`)];
    const p=createBattle({beys:[myBey,opp.bey],launches});
    p.meta={round,launches,beyName:myBey.name,experiment:!!experiment};
    setPlayer(p);setPhase('countdown');setCount(3);setPaused(false);setSpeed(1);
    let c=3;const iv=setInterval(()=>{c--;setCount(c);if(c<0){clearInterval(iv);p.start();setPhase('fight');}},650);
  };

  // Detect end of playback.
  useEffect(()=>{
    if(phase!=='fight'||!player)return;
    let raf;const tick=()=>{player.getTime();if(player.finished){
      const res=player.result, pts=res.points;
      const next=[...score];next[res.winner]+=pts;
      setScore(next);
      setRounds(r=>[...r,{...player.meta,result:res,summary:player.summary}]);
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
          <span className="model-note" style={{color:'#bbb'}}>模型结果 · MuJoCo 4 kHz</span>
        </div>}
        {onPrep&&<PrepPanel {...{save,myBey,setBeyUid,style,setStyle,prediction,setPrediction,shoot,opp,experiment,first:phase==='prep'&&!rounds.length,lastRound:rounds.at(-1),myName}}/>}
      </div>
      {phase==='result'&&<ResultPanel {...{won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,
        onExperiment:()=>{const last=rounds.at(-1);setExperiment({launches:last.launches,prev:last});setScore([0,0]);setRounds([]);roundRef.current=0;setPlayer(null);setPhase('prep');}}}/>}
    </div>
  );
}

function Hud({player,names,beys,score,target,color,round}){
  const [st,setSt]=useState(null);
  useEffect(()=>{if(!player)return;let raf;const f=()=>{setSt(player.getState(player.clock));raf=requestAnimationFrame(f);};f();return()=>cancelAnimationFrame(raf);},[player]);
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

function ResultPanel({won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,onExperiment}){
  const [ai,setAi]=useState(null);
  const [recruitOpen,setRecruitOpen]=useState(false);
  const decisive=rounds.at(-1);
  const pred=PREDICT.find(p=>p.id===prediction);
  const predOk=pred&&(won?pred.match?.(decisive.result.reason):pred.id==='lose');
  const tier=blader?.tier;
  const first=blader&&!save.defeated.includes(blader.id);
  const coins=won?(REWARD[tier]||[80,40])[first?0:1]+(predOk?20:0):20;
  const done=useRef(false);
  const canRecruit=won&&tier==='pro'&&!save.team.some(t=>t.bladerId===blader.id);
  useEffect(()=>{
    if(done.current)return;done.current=true;
    if(!decisive.experiment)recordMatch({bladerId:won?blader?.id:null,won,coins,prediction:pred?{id:pred.id,correct:!!predOk,opp:opp.name}:null});
    commentary(decisive.summary,[myBey.name,opp.bey.name]).then(r=>{setAi(r);if(r?.science?.cardId)unlockCards([r.science.cardId]);});
    if(canRecruit)setTimeout(()=>setRecruitOpen(true),900);
  },[]);// eslint-disable-line
  const card=ai?.science?.cardId&&getCard(ai.science.cardId);
  return (
    <div className="result slidein">
      <div className="row wrap" style={{gap:24,alignItems:'center'}}>
        <div className={`h-display ${won?'h-red':'h-outline'}`} style={{fontSize:'clamp(56px,8vw,96px)',transform:'rotate(-4deg)'}}>{won?'VICTORY!':'DEFEAT…'}</div>
        <div>
          <div style={{fontWeight:900,fontSize:22}}>{score[0]} : {score[1]} · 决胜：{FINISH_LABEL[decisive.result.reason]}（{FINISH_ZH[decisive.result.reason]}）</div>
          <div style={{marginTop:4,fontWeight:700}}>{decisive.experiment?'🔬 实验对局不计奖励':<>奖励：🪙 +{coins}{first&&won?' · 首次击败！':''}</>}</div>
        </div>
      </div>
      <div className="result-grid mt">
        <div className="panel" style={{padding:18,color:'#111'}}>
          <div className="row" style={{gap:12}}><DoctorFace mood={ai?'excited':'thinking'} size={64}/><div className="h-display" style={{fontSize:26}}>融合博士的复盘</div></div>
          {!ai&&<div className="bubble mt">正在看回放、读数据……</div>}
          {ai&&<>
            <div className="panel-title mt" style={{fontSize:20}}>{ai.headline}</div>
            <ol className="story">{(ai.story||[]).map((s,i)=><li key={i}>{s}</li>)}</ol>
            {card?<KnowledgeChip card={card} defaultOpen/>:ai.science&&<div className="bubble">{ai.science.title}：{ai.science.body}</div>}
            <div className="model-note mt">复盘只引用这一局记录到的事件；结论都是「在这个模型里」成立。{ai.fallback?'（AI 暂时没连上，这是模板复盘）':''}</div>
          </>}
        </div>
        <div className="col" style={{gap:14}}>
          {pred&&!decisive.experiment&&<div className="panel" style={{padding:14,color:'#111'}}><b>你的预测：</b>{pred.label} → {predOk?<b style={{color:'#0c8f74'}}>猜对了！🪙 +20</b>:<b>没猜中，看看复盘找原因</b>}</div>}
          {decisive.experiment&&<ExperimentCompare rounds={rounds} myName={myName} opp={opp}/>}
          <div className="panel ink" style={{padding:16,boxShadow:'6px 6px 0 var(--red)'}}>
            <div className="h-display h-yellow" style={{fontSize:20}}>科学小实验：只改一个变量</div>
            <p style={{lineHeight:1.6,fontWeight:700}}>{ai?.tryNext||'保持对手和发射条件完全一样，只换一个零件，结果会变吗？'}</p>
            <div className="row wrap" style={{gap:8}}>
              <button className="btn yellow small" onClick={onExperiment}>同样条件再打一次</button>
              <button className="btn small" onClick={()=>go('fusion',{back:'map'})}>去融合工坊改造</button>
            </div>
          </div>
          <div className="row" style={{gap:10}}>
            <button className="btn primary grow" onClick={()=>go('map')}>回到地图</button>
            <button className="btn grow" onClick={()=>go('battle',{...useGame.getState().params})}>再战一次</button>
          </div>
        </div>
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
