import {useEffect,useMemo,useRef,useState} from 'react';
import {hush} from '../game/voiceClips.js';
import {beyTitle} from './beyName.js';
import {useGame,bladerById} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {WIN_ROUNDS,FINISH_LABEL,FINISH_ZH} from '../game/story.js';
import {createBattle} from '../game/battlePlayer.js';
import {useTaskScope} from '../game/useTaskScope.js';
import {resultCacheKey} from '../game/resultCache.js';
import {commentary} from '../ai/client.js';
import {getCard} from '../knowledge/cards.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import BattleScene from '../scene/BattleScene.jsx';
import BeyArt from './BeyArt.jsx';
import {Portrait,Modal,TypeBadge} from './common.jsx';
import {DoctorFace} from './MapScreen.jsx';
import LaunchSequence from './LaunchSequence.jsx';
import PauseMenu from './PauseMenu.jsx';
import {teamRoster,mateLaunch} from '../game/team.js';
import ResultPanel from './result/ResultPanel.jsx';
import * as aiClient from '../ai/client.js';
import './battle.css';
import * as sfx from '../game/sfx.js';

import {STYLES,cpuLaunch,playerLaunch} from '../game/launch.js';
export {STYLES,cpuLaunch,playerLaunch};

export const RESULT_KEY=()=>resultCacheKey(useGame.getState().saveKey,location.pathname,location.search);
export const clearSavedResult=(key=RESULT_KEY())=>{try{sessionStorage.removeItem(key);}catch{}};
// 只有“刷新页面后第一次挂载的对战页”才恢复结算；站内的再战一次 / 带改装版再战 / 新开一场都从头开始。
// （纯函数：按本次页面加载的 timeOrigin 记账，React 开发模式重复调用初始化也不会误判。）
const LOAD_ID=()=>String(Math.round(performance.timeOrigin||0));
const pageWasReloaded=()=>{try{return performance.getEntriesByType('navigation')[0]?.type==='reload';}catch{return false;}};
function peekSavedResult(){
  try{
    if(!pageWasReloaded()||sessionStorage.getItem('kos-result-used')===LOAD_ID())return null;
    const r=JSON.parse(sessionStorage.getItem(RESULT_KEY())||'null');return r&&Date.now()-r.at<3600_000?r:null;
  }catch{return null;}
}
const markRestoreUsed=()=>{try{sessionStorage.setItem('kos-result-used',LOAD_ID());}catch{}};
export default function BattleScreen(){
  const tasks=useTaskScope();
  const {save,params,go,recordMatch,unlockCards,recruit,addCoins}=useGame();
  const blader=params.bladerId?bladerById(params.bladerId):null;
  const opp=useMemo(()=>blader?{name:blader.name,bey:blader.bey,launch:blader.launch,color:blader.color,blader}:(()=>{const look=params.oppLook?bladerById(params.oppLook):null; // optional cosmetic opponent (versus mode: a defeated blader's portrait/taunt, no story effects)
    return {name:look?.name||'CPU',bey:params.oppBey||BEYS.titan,launch:look?.launch||{rpm:4900,tilt:4,speed:.35,aim:.5},color:look?.color||'#8d99a6',...(look?{blader:look}:{})};})(),[blader,params.oppBey,params.oppLook]);
  const target=save.demo?2:(params.rounds||WIN_ROUNDS);   // rounds to win (5 局 3 胜)
  const myName=save.profile?.nickname||'你';

  // 结算页刷新保护：整场打完后把结果存进 sessionStorage，刷新同一个地址时直接回到结算页（奖励不会重复发放）。
  const [restored]=useState(peekSavedResult);
  useEffect(()=>{markRestoreUsed();if(!restored)clearSavedResult();},[]);// eslint-disable-line   本次页面加载只恢复一次；没恢复就清掉旧结果
  const [beyUid,setBeyUid]=useState(restored?.beyUid||params.beyUid||save.collection[0]?.uid);
  // 谁上场: null = the kid; else a recruited teammate's blader id (single-player battles only).
  const team=useMemo(()=>teamRoster(save),[save.team,save.collection]);// eslint-disable-line
  const [pilot,setPilot]=useState(null);
  const ownUid=useRef(beyUid);
  const pickPilot=id=>{
    const m=team.find(t=>t.id===id);
    if(!pilot)ownUid.current=beyUid;
    setPilot(m?m.id:null);
    if(m?.beyUid&&save.collection.some(b=>b.uid===m.beyUid))setBeyUid(m.beyUid);
    else if(!m)setBeyUid(ownUid.current);
    sfx.beep(true);
  };
  const mate=pilot?team.find(t=>t.id===pilot):null;
  const myBey=save.collection.find(b=>b.uid===beyUid)||save.collection[0];
  const [prediction,setPrediction]=useState(restored?.prediction??null);
  const [phase,setPhase]=useState(restored?'result':'prep'); // prep | countdown | fight | roundEnd | result
  const [player,setPlayer]=useState(null);
  const [score,setScore]=useState(restored?.score||[0,0]);
  const [rounds,setRounds]=useState(restored?.rounds||[]);
  const [experiment,setExperiment]=useState(null); // {launches, prev}
  const [speed,setSpeed]=useState(1);
  const [paused,setPaused]=useState(false);
  const roundRef=useRef(0);
  // Static stand-in so BattleScene (and its canvas/shaders) is mounted before the first launch.
  const idlePlayer=useMemo(()=>{const st={time:0,bodies:[{p:[-.09,0,.045],q:[1,0,0,0],rpm:0,tilt:0},{p:[.09,0,.045],q:[1,0,0,0],rpm:0,tilt:0}]};
    return {beys:[myBey,opp.bey],events:[],getTime:()=>0,getState:()=>st};},[myBey,opp.bey]);

  useEffect(()=>()=>{player?.dispose();sfx.spinHum(false);},[player]);
  const [muted,setMutedState]=useState(sfx.isMuted());

  // launch: from the slingshot (rpm/speed/aim/tilt) — the cut-in already played, so the round starts immediately.
  const shoot=(launch)=>{
    const round=++roundRef.current;
    const mine={rpm:launch.rpm,speed:launch.speed,aim:launch.aim,tilt:launch.tilt,angle:Math.PI+((round*37)%11-5)*.04};
    if(launch.synergy)mine.synergy=true;
    const launches=experiment?.launches||[mine,cpuLaunch(opp.launch,`${opp.name}-${save.battles}-${round}`)];
    const p=createBattle({beys:[myBey,opp.bey],launches});
    p.meta={round,launches,beyName:beyTitle(myBey),bey:myBey,pilot:mate?{id:mate.id,name:mate.name}:null,experiment:!!experiment};
    p.onEvent(e=>{if(e.type==='collision')sfx.clang(e.intensity);if(e.type==='dash')sfx.whoosh();if(e.type==='finish'){sfx.spinHum(false);sfx.fanfare(e.winner===0);}});
    p.onError(()=>{sfx.spinHum(false);setPhase('error');});
    setPlayer(p);setPaused(false);setSpeed(1);p.start();sfx.spinHum(true);setPhase('fight');
  };

  // Detect end of playback.
  useEffect(()=>{
    if(phase!=='fight'||!player)return;
    let raf;const tick=()=>{player.getTime();if(player.finished){
      const res=player.result, pts=res.points;
      const next=[...score];next[res.winner]+=1;
      setScore(next);
      setRounds(r=>[...r,{...player.meta,result:res,summary:player.summary,samples:player.samples,events:player.events}]);
      // advance after 2.6 s of *unpaused* time
      let left=2600;const step=()=>{if(!pauseRef.current)left-=100;if(left<=0)setPhase(next[0]>=target||next[1]>=target?'result':'roundEnd');else tasks.schedule(step,100);};tasks.schedule(step,100);
      return;}raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[phase,player]);// eslint-disable-line

  useEffect(()=>{if(phase!=='result')return;
    try{sessionStorage.setItem(RESULT_KEY(),JSON.stringify({at:Date.now(),score,rounds,prediction,beyUid}));}
    catch{try{sessionStorage.setItem(RESULT_KEY(),JSON.stringify({at:Date.now(),score,prediction,beyUid,rounds:rounds.map(r=>({...r,samples:(r.samples||[]).filter((_,i)=>i%4===0)}))}));}catch{}}
  },[phase]);// eslint-disable-line
  const won=score[0]>=target;
  const onPrep=phase==='prep'||phase==='roundEnd';
  // HUD round: during prep/round-end we're about to play the NEXT round.
  const shownRound=phase==='result'?roundRef.current:onPrep?roundRef.current+1:roundRef.current;
  // Pause/exit: freeze physics + the round-end timer; exit doesn't record anything.
  const pauseRef=useRef(false);
  const setPausedAll=on=>{pauseRef.current=on;if(player&&phase==='fight'){player.setPaused(on||paused);}if(on)sfx.spinHum(false);else if(phase==='fight'&&!paused)sfx.spinHum(true);};
  const exitBattle=()=>{
    player?.dispose?.();sfx.spinHum(false);hush();
    const p=useGame.getState().params||{};
    if(p.from==='explore')go('explore',{regionId:p.regionId||p.region});
    else if(p.from&&p.from!=='battle')go(p.from);
    else go(blader?'map':'versus');
  };

  if(!myBey)return <div className="page"><div className="panel"><p>先选一只陀螺，再来挑战吧！</p><button className="btn primary" onClick={()=>go('starter')}>选择初始陀螺</button></div></div>;
  if(phase==='error')return <div className="page"><div className="panel"><p>对战暂时没能启动，请再试一次</p><button className="btn primary" onClick={()=>{player?.dispose();setPlayer(null);setPhase(rounds.length?'roundEnd':'prep');}}>重新发射</button><button className="btn" onClick={exitBattle}>返回</button></div></div>;

  return (
    <div className="page dark battle-page">
      <Hud player={player} names={[mate?mate.name:myName,opp.name]} beys={[myBey,opp.bey]} score={score} target={target} color={opp.color} round={shownRound}/>
      <div className="battle-stage">
        {/* One BattleScene stays mounted from the start (idle player until the first launch) so the WebGL canvas is warm and the cut-in hands straight into the battle. */}
        {phase!=='result'&&<PauseMenu onPause={setPausedAll} onExit={exitBattle}/>}
        <BattleScene player={player||idlePlayer} frameloop={player?'always':'demand'} style={{position:'absolute',inset:0}}/>
        {phase==='fight'&&<div className="fight-controls">
          {[1,2,4].map(s=><button key={s} className={`btn small ${speed===s?'yellow':''}`} onClick={()=>{player.setSpeed(s);setSpeed(s);}}>{s}×</button>)}
          <button className="btn small" onClick={()=>{sfx.setMuted(!muted);setMutedState(!muted);}}>{muted?'🔇':'🔊'}</button>
          <span className="model-note" style={{color:'#bbb'}}>模型结果 · MuJoCo 4 kHz</span>
        </div>}
        {onPrep&&<LaunchSequence key={roundRef.current} me={{name:myName,avatar:/^[1-4]$/.test(String(save.profile?.avatar))?String(save.profile.avatar):null}} opp={opp} beys={save.collection} beyUid={myBey.uid} setBeyUid={setBeyUid}
          first={phase==='prep'&&!rounds.length} lastRound={rounds.at(-1)} onPredict={setPrediction} onLaunch={shoot}
          team={team} pilot={pilot} onPilot={pickPilot} makeMateLaunch={m=>mateLaunch(m.blader,myBey,`${m.id}-${save.battles}-${roundRef.current+1}`)}
          lastLabel={rounds.length?`上一回合：${FINISH_LABEL[rounds.at(-1).result.reason]} · ${rounds.at(-1).result.winner?opp.name:myName} 赢下这局　局分 ${score[0]} : ${score[1]}`:''}/>}
      </div>
      {phase==='result'&&<ResultPanel restored={!!restored} {...{won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,addCoins,
        }}/>}
    </div>
  );
}

export function Hud({player,names,beys,score,target,color,round}){
  const [st,setSt]=useState(null);
  useEffect(()=>{if(!player)return;let raf;const f=()=>{const cur=player.getState(player.clock);setSt(cur);if(cur&&!player.paused)sfx.spinRpm(cur.bodies[0]?.rpm,cur.bodies[1]?.rpm);raf=requestAnimationFrame(f);};f();return()=>cancelAnimationFrame(raf);},[player]);
  const side=(i)=>{const b=st?.bodies?.[i],rpm=Math.max(0,Math.abs(b?.rpm||0));return (
    <div className={`hud-side ${i?'right':''}`} style={{background:i?'#ff9f1a':'#2f7bff'}}>
      <div className="hud-top"><span className="hud-name"><b>{names[i]}</b><em> · {beyTitle(beys[i])}</em></span><span className="hud-pts">{score[i]}<small> 胜</small></span></div>
      <div className="hud-bar"><span className="hud-bar-l">转速</span><i style={{width:`${Math.min(100,rpm/70)}%`,background:rpm<1200?'var(--red)':'var(--yellow)'}}/></div>
      <div className="hud-meta">{Math.round(rpm).toLocaleString()} RPM · 倾角 {Math.round(b?.tilt||0)}°</div>
    </div>);};
  return (
    <div className="hud">
      {side(0)}
      <div className="hud-mid"><div>ROUND {Math.max(1,round)}</div><div className="hud-time">{(st?.time||0).toFixed(1)}s</div><div className="hud-target">{target*2-1} 局 {target} 胜</div></div>
      {side(1)}
    </div>
  );
}

