import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {beyTitle} from '../beyName.js';
import {useGame} from '../../game/store.js';
import {FINISH_LABEL,FINISH_ZH,BLADERS} from '../../game/story.js';
import {commentary} from '../../ai/client.js';
import * as aiClient from '../../ai/client.js';
import {getCard} from '../../knowledge/cards.js';
import {KnowledgeChip} from '../../knowledge/KnowledgeCard.jsx';
import {findMoments} from '../../game/moments.js';
import {openFlipbook} from '../../flipbook/store.js';
import {momentCard} from '../../ai/fallback.js';
import {freshQuiz, markSeen} from '../../knowledge/quizSeen.js';
import ExperimentLab from '../../lab/ExperimentLab.jsx';
import ReplaySlot from '../ReplaySlot.jsx';
import GuidedReview from './GuidedReview.jsx';
import RpmChart from '../RpmChart.jsx';
import {clearSavedResult,RESULT_KEY} from '../BattleScreen.jsx';
import BeyArt from '../BeyArt.jsx';
import LookSvg from './LookSvg.jsx';
import {Portrait,Modal} from '../common.jsx';
import {DoctorFace} from '../MapScreen.jsx';
import * as sfx from '../../game/sfx.js';
import './result.css';

const PREDICT=[{id:'ko',label:'把对手撞出界（OVER / XTREME）',match:r=>r==='over'||r==='xtreme'},{id:'spin',label:'比谁转得久（SPIN / 判定）',match:r=>r==='spin'||r==='judge'},{id:'lose',label:'我觉得会输……',match:null}];
const REWARD={normal:[120,60],pro:[160,80],super:[220,100],boss:[400,150]};
const MOMENT_TITLE={'first-hit':'第一次碰撞','big-hit':'最猛的一撞','spin-drop':'转速大跳水','dash':'冲刺！','finish':'决胜时刻'};
const PAGES=[{id:'result',label:'结果'},{id:'review',label:'复盘'},{id:'lab',label:'实验室'},{id:'next',label:'接下来去哪'}];
const NUM='①②③④⑤';
const HIGHLIGHT_MS=4200;
const REPLAY_BAR_PX=150;   // ReplayViewer's control bar + scrubber below the 3D view   // the slow-mo highlight is ~7 s; the quiz pops once the key instant has played
function localMoment(m,names){
  const n=i=>i===0?`你的 ${names[0]}`:names[1];const d=m.data||{};
  if(m.kind==='first-hit'||m.kind==='big-hit')return `相对速度 ${(d.relSpeed||0).toFixed(1)} m/s 的碰撞。撞完 ${n(0)} 约 ${Math.round((d.rpmAfter?.[0]||0)/100)*100} 转、${n(1)} 约 ${Math.round((d.rpmAfter?.[1]||0)/100)*100} 转——撞击会把转动的能量变成乱跑和晃动。`;
  if(m.kind==='spin-drop')return `1 秒内 ${n(m.body)} 的转速掉了约 ${Math.round((d.drop||0)/100)*100} 转。看看这一秒它撞到了什么？`;
  if(m.kind==='finish')return `${n(1-d.winner)} ${({spin:'先停转了',over:'飞出了场地',xtreme:'掉进了 Xtreme 口',judge:'时间到时转速更低'})[d.reason]||''}。`;
  if(m.kind==='dash')return `${n(m.body??0)} 的齿轮咬住了边缘齿轨，把转动变成了往前冲！`;
  return '';
}
function suggestVariable(bey,won){
  if(!won&&(bey.bit==='flat'||bey.bit==='rush'))return {key:'bit',value:'ball',why:'平轴掉转快'};
  if(bey.bit==='needle')return {key:'bit',value:'ball',why:'试试更稳的圆轴'};
  if((bey.blade?.ring??60)<70)return {key:'ring',value:80,why:'外圈还能再重点'};
  return {key:'bit',value:'needle',why:'看看能不能转更久'};
}
function useCountUp(target,run,ms=1100){
  const [v,setV]=useState(0);
  useEffect(()=>{if(!run)return;let raf;const t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/ms);setV(Math.round(target*(1-Math.pow(1-k,3))));if(k<1)raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);return()=>cancelAnimationFrame(raf);},[target,run,ms]);
  return v;
}
function useBoxHeight(){
  const ref=useRef(null);const [h,setH]=useState(0);
  useEffect(()=>{const el=ref.current;if(!el)return;const ro=new ResizeObserver(([e])=>setH(Math.round(e.contentRect.height)));ro.observe(el);return()=>ro.disconnect();},[]);
  return [ref,h];
}

export default function ResultPanel({won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,addCoins,restored}){
  const [aiBy,setAiBy]=useState({});       // AI review per round index
  const [recruitOpen,setRecruitOpen]=useState(false);
  const [recruited,setRecruited]=useState(false);
  const [page,setPage]=useState(0);
  const [dir,setDir]=useState(1);
  const decisive=rounds.at(-1);
  // Which round the review/lab focuses on: defaults to the decisive (last) round; the kid can pick any round.
  const [ri,setRi]=useState(rounds.length-1);
  const focus=rounds[ri]||decisive;
  const ai=aiBy[ri]??null;
  const roundBey=focus.bey||myBey;   // the bey actually used in the focused round (a teammate may have played it)
  const names=[beyTitle(roundBey),beyTitle(opp.bey)];
  const moments=useMemo(()=>findMoments(focus.samples,focus.events,focus.result),[focus]);
  const pred=PREDICT.find(p=>p.id===prediction);
  const predOk=pred&&(won?pred.match?.(decisive.result.reason):pred.id==='lose');
  const tier=blader?.tier;
  const [first]=useState(()=>!!blader&&!save.defeated.includes(blader.id)&&!restored);
  const coins=won?(REWARD[tier]||[80,40])[first?0:1]+(predOk?20:0):20;
  const done=useRef(false);
  const [canRecruit]=useState(()=>won&&tier==='pro'&&!save.team.some(t=>t.bladerId===blader.id));
  useEffect(()=>{const key=RESULT_KEY();return()=>clearSavedResult(key);},[]);   // 站内离开结算页就清掉；刷新不会触发卸载
  useEffect(()=>{
    if(done.current)return;done.current=true;
    if(restored)return;   // 刷新后恢复的结算页：比赛和奖励已经记过了
    recordMatch({bladerId:won?blader?.id:null,won,coins,prediction:pred?{id:pred.id,correct:!!predOk,opp:opp.name}:null});
    sfx.say?.(won?'Victory!':'Defeat…','en-US',1);
  },[]);// eslint-disable-line

  useEffect(()=>{
    if(aiBy[ri]!==undefined)return;
    setAiBy(m=>({...m,[ri]:null}));
    const req=aiClient.moments?aiClient.moments({summary:focus.summary,moments,names}):commentary(focus.summary,names);
    Promise.resolve(req).then(r=>{setAiBy(m=>({...m,[ri]:r||{}}));const ids=(r?.moments||[]).map(m=>m.cardId).concat(r?.science?.cardId||[]).filter(Boolean);if(ids.length)unlockCards(ids);}).catch(()=>setAiBy(m=>({...m,[ri]:{}})));
  },[ri]);// eslint-disable-line
  const goPage=useCallback(n=>{setPage(p=>{const q=Math.max(0,Math.min(PAGES.length-1,typeof n==='function'?n(p):n));setDir(q>=p?1:-1);return q;});},[]);
  useEffect(()=>{
    const onKey=e=>{if(recruitOpen||e.target.closest?.('input,textarea,select'))return;if(e.key==='ArrowRight')goPage(p=>p+1);if(e.key==='ArrowLeft')goPage(p=>p-1);};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[goPage,recruitOpen]);
  useEffect(()=>{if(page!==1)sfx.say&&window.speechSynthesis?.cancel();},[page]);
  // Swipe between pages (touch only; mouse drags are left to the 3D replay / scrubber).
  const swipe=useRef(null);
  const onPointerDown=e=>{if(e.pointerType!=='touch'||e.target.closest('.ks-rv-track,canvas,input,.rp-scroll'))return;swipe.current={x:e.clientX,y:e.clientY};};
  const onPointerUp=e=>{const s=swipe.current;swipe.current=null;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)goPage(p=>p+(dx<0?1:-1));};

  return (
    <div className="rp" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div className="rp-top">
        <div className="rp-chips">{PAGES.map((p,i)=><button key={p.id} className={`rp-chip ${i===page?'on':''}`} onClick={()=>goPage(i)}><span>{i+1}</span>{p.label}</button>)}</div>
        {page!==3&&rounds.length>1&&<RoundPicker rounds={rounds} ri={ri} setRi={setRi} myName={myName} oppName={opp.name}/>}
        <div className="rp-score">{myName} <b>{score[0]} : {score[1]}</b> {opp.name}</div>
        <button className="rp-continue" onClick={()=>{window.speechSynthesis?.cancel();fromExplore()?backToExplore():fromVersus()?go('versus'):go('map');}}>{fromExplore()?'🧭 继续探险 ▶':fromVersus()?'⚔️ 回到对战模式 ▶':'🗺️ 继续冒险 ▶'}</button>
      </div>
      <div className="rp-stage">
        <div key={page} className={`rp-page ${dir>0?'turn-fwd':'turn-back'}`}>
          {page===0&&<ResultPage {...{won,score,decisive,myBey,opp,coins,first,pred,predOk,canRecruit,recruited,blader}} onRecruit={()=>setRecruitOpen(true)} onNext={()=>goPage(1)}/>}
          {page===1&&<>
            <ReviewPage key={ri} {...{opp,moments,names,ai,unlockCards,addCoins}} myBey={roundBey} decisive={focus} onNext={()=>goPage(2)}/>
          </>}
          {page===2&&<div className="rp-scroll"><ExperimentLab key={'lab'+ri} mine={roundBey} opp={opp.bey} launches={focus.launches} names={names} suggest={suggestVariable(roundBey,won)} onReward={n=>addCoins(n)} onUnlock={unlockCards}/></div>}
          {page===3&&<NextPage {...{won,ai,go,myBey}}/>}
        </div>
      </div>
      <div className="rp-nav">
        {page>0?<button className="rp-arrow" onClick={()=>goPage(p=>p-1)} aria-label="上一页">◀ {PAGES[page-1].label}</button>:<span/>}
        <span/>
        {page===1&&<button className="rp-arrow next" onClick={()=>goPage(2)} aria-label="去实验室">试着改一个零件 ▶</button>}
        {page===2&&<button className="rp-arrow next" onClick={()=>goPage(3)} aria-label="接下来去哪">离开实验室 · 接下来去哪 ▶</button>}
      </div>
      {recruitOpen&&<RecruitModal blader={blader} save={save} onDone={(uid)=>{recruit(blader.id,uid);setRecruited(true);setRecruitOpen(false);}} onClose={()=>setRecruitOpen(false)}/>}
    </div>
  );
}

// Compact round selector in the top bar: one numbered chip per round (blue = you scored, red = opponent), ★ = decisive.
const FINISH_ICON={xtreme:'💥',over:'💨',burst:'💢',spin:'🌀',judge:'⏱'};
function RoundPicker({rounds,ri,setRi,myName,oppName}){
  const cur=rounds[ri];
  return <div className="rp-rounds" role="tablist" aria-label="选择要复盘的回合">
    <span className="rp-rounds-t">看第几局</span>
    {rounds.map((r,i)=>{const w=r.result.winner===0;return <button key={i} role="tab" aria-selected={i===ri} title={`第 ${i+1} 局 · ${r.pilot?.name||myName} · ${r.beyName||''} · ${w?'赢':'输'} · ${FINISH_ZH[r.result.reason]}`}
      className={`rp-round ${i===ri?'on':''} ${w?'win':'lose'} ${r.pilot?'mate':''}`} onClick={()=>setRi(i)}>{r.pilot&&<img className="rp-round-face" src={`/art/bladers/${r.pilot.id}.png`} alt=""/>}{i+1}<i>{FINISH_ICON[r.result.reason]||''}</i>{i===rounds.length-1&&<em>★</em>}</button>;})}
    <span className="rp-rounds-cap"><b>{cur.pilot?.name||myName} · {cur.beyName}</b> {cur.result.winner===0?'赢':'输'} · {FINISH_ZH[cur.result.reason]}{ri===rounds.length-1?' · 决胜局':''}</span>
  </div>;
}

const fromExplore=()=>useGame.getState().params?.from==='explore';
const fromVersus=()=>useGame.getState().params?.from==='versus';
function backToExplore(){const p=useGame.getState().params||{};useGame.getState().go('explore',{regionId:p.regionId||p.region});}
// The result page sits above the shared showcase canvas (and pops in with a scale animation that breaks a
// standalone canvas' sizing), so designed beys use their look-aware 2D art here.
function ResultBeyArt({bey,spin}){
  if(!(bey?.look||bey?.parents||bey?.fusedBy))return <BeyArt bey={bey} size={150} spin={spin}/>;
  return <LookSvg bey={bey} size={150} spin={spin}/>;
}
function ResultPage({won,score,decisive,myBey,opp,coins,first,pred,predOk,canRecruit,recruited,blader,onRecruit,onNext}){
  const fromExp=fromExplore();
  const shown=useCountUp(coins,true,1300);
  const reason=decisive.result.reason;
  return (
    <div className={`rp-result ${won?'win':'lose'}`}>
      <div className="rp-burst"/>
      <div className="rp-splash">
        <div className={`rp-sfx ${won?'win':'lose'}`}>{won?'VICTORY!':'DEFEAT…'}</div>
        <div className="rp-vs">
          <div className={`rp-bey ${won?'champ':''}`}><ResultBeyArt bey={myBey} spin={won}/><b>{beyTitle(myBey)}</b></div>
          <div className="rp-bigscore">{score[0]}<span>:</span>{score[1]}</div>
          <div className={`rp-bey ${won?'':'champ'}`}><ResultBeyArt bey={opp.bey} spin={!won}/><b>{beyTitle(opp.bey)}</b></div>
        </div>
        <div className="rp-finish"><span>决胜</span>{FINISH_LABEL[reason]} · {FINISH_ZH[reason]} · {decisive.result.time.toFixed(1)} 秒</div>
      </div>
      <div className="rp-side">
        <div className="rp-reward"><span className="kicker">REWARD</span><div className="rp-coins">🪙 +{shown}</div>{first&&won&&<div className="rp-first">首次击败！</div>}</div>
        {pred&&<div className={`rp-stamp ${predOk?'ok':'no'}`}><b>{predOk?'✓':'✗'}</b><span>赛前预测<br/>{predOk?'猜对了！+20':'没猜中'}</span></div>}
        {canRecruit&&<div className="rp-cutin" onClick={recruited?undefined:onRecruit}>
          <Portrait blader={blader} size={96}/>
          <div><div className="sfx" style={{fontSize:30,color:'var(--yellow)'}}>{recruited?'入队！':'招募！'}</div><div style={{fontWeight:800}}>{recruited?`${blader.name} 加入了你的队伍`:`${blader.name} 想加入你的队伍！`}</div>{!recruited&&<button className="btn small yellow" style={{marginTop:6}}>点我招募</button>}</div>
        </div>}
        <button className="btn primary big rp-cta" onClick={onNext}>{won?'看看为什么赢了 ▶':'看看为什么输了 ▶'}</button>
        {fromExp&&<button className="btn yellow big" onClick={backToExplore}>🧭 回到探索 ▶</button>}
      </div>
    </div>
  );
}

// Review page: guided "博士讲解模式" by default; "我自己看" switches to the manual moment strip.
function ReviewPage(props){
  const [mode,setMode]=useState('guide');
  const titleOf=useCallback(m=>MOMENT_TITLE[m.kind]||'关键时刻',[]);
  const fallbackOf=useCallback(m=>localMoment(m,props.names),[props.names]);
  if(mode==='guide')return <GuidedReview {...props} titleOf={titleOf} fallbackOf={fallbackOf} onManual={()=>{window.speechSynthesis?.cancel();setMode('manual');}}/>;
  return <ManualReview {...props} onGuide={()=>setMode('guide')}/>;
}

function ManualReview({decisive,myBey,opp,moments,names,ai,unlockCards,addCoins,onNext,onGuide}){
  const viewer=useRef(null);
  const beys=useMemo(()=>[myBey,opp.bey],[myBey,opp.bey]); // stable: a new array would reset the replay player
  const [boxRef,boxH]=useBoxHeight();
  const [sel,setSel]=useState(null);           // selected moment id
  const [quizOn,setQuizOn]=useState(false);
  const [answers,setAnswers]=useState({});
  const [chart,setChart]=useState(false);
  const [cursor,setCursor]=useState(null);
  const [auto,setAuto]=useState(false);
  const timers=useRef([]);
  const aiM=id=>(ai?.moments||[]).find(m=>m.id===id);
  // One quiz per moment, never a repeat of what this kid has already been asked (any feature).
  const quizMap=useMemo(()=>{if(!ai)return {};const o={};for(const m of moments){const concept=m.kind==='finish'&&/over|xtreme/.test(m.data?.reason||'')?'ph-momentum':momentCard(m);const q=freshQuiz(aiM(m.id)?.quiz,concept);if(q)o[m.id]=q;}return o;},[ai]);// eslint-disable-line
  useEffect(()=>{if(quizOn&&sel&&quizMap[sel])markSeen(quizMap[sel].id,quizMap[sel].alsoIds||[]);},[quizOn,sel]);// eslint-disable-line
  const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[];};
  useEffect(()=>()=>{clear();window.speechSynthesis?.cancel();},[]);
  // 先猜再揭晓: with an unanswered quiz the replay freezes just BEFORE the moment, the quiz shows with no
  // explanation; only after the kid answers does the slow-mo play and the explanation appear.
  const reveal=(m)=>{
    viewer.current?.playMoment?.(m.id);
    const line=aiM(m.id)?.dj;if(line)timers.current.push(setTimeout(()=>sfx.say(line,'zh-CN',1.2),600));
  };
  const play=useCallback((m,{withQuiz=true}={})=>{
    clear();setSel(m.id);setQuizOn(false);
    if(withQuiz&&quizMap[m.id]&&answers[m.id]==null){
      viewer.current?.seek?.(Math.max(0,m.time-.6));viewer.current?.pause?.();
      setQuizOn(true);return;
    }
    reveal(m);
  },[ai,answers,quizMap]);// eslint-disable-line
  const playAll=()=>{
    if(auto){clear();setAuto(false);return;}
    setAuto(true);clear();
    moments.forEach((m,i)=>timers.current.push(setTimeout(()=>play(m,{withQuiz:false}),i*7600)));
    timers.current.push(setTimeout(()=>setAuto(false),moments.length*7600));
  };
  const cur=moments.find(m=>m.id===sel);const curAi=cur&&aiM(cur.id);
  const answer=(m,i)=>{const q=quizMap[m.id];setAnswers(x=>({...x,[m.id]:i}));if(i===q.answer){sfx.beep(true);addCoins(5);}else sfx.beep();const c=aiM(m.id)?.cardId;if(c)unlockCards([c]);clear();reveal(m);};
  return (
    <div className="rp-review">
      <div className="rp-review-head">
        <DoctorFace mood={ai?'excited':'thinking'} size={44}/>
        <div className="grow"><div className="rp-h">复盘 · {ai?.headline||'关键时刻'}</div><div className="rp-sub">点下面的关键时刻，慢动作回看发生了什么</div></div>
        <button className={`btn small ${auto?'yellow':''}`} onClick={playAll}>{auto?'⏹ 停止':'▶ 自动播放全部关键时刻'}</button>
        <button className={`btn small ${chart?'yellow':''}`} onClick={()=>setChart(c=>!c)}>📈 转速</button>
        <button className="btn small yellow" onClick={onGuide}>🎙 博士讲解</button>
      </div>
      <div className="rp-replay" ref={boxRef}>
        {boxH>0&&<ReplaySlot ref={viewer} height={Math.max(180,boxH-REPLAY_BAR_PX)} beys={beys} samples={decisive.samples} events={decisive.events}
          moments={moments.map(m=>({id:m.id,time:m.time,title:aiM(m.id)?.title||MOMENT_TITLE[m.kind]}))} onSeek={setCursor}/>}
        {cur&&<div key={sel} className="rp-balloon">
          <div className="rp-balloon-t">{NUM[cur.n-1]} {curAi?.title||MOMENT_TITLE[cur.kind]} <small>{cur.time.toFixed(1)} 秒</small></div>
          {(()=>{const waiting=quizMap[cur.id]&&answers[cur.id]==null;   // no answer may leak before the kid guesses
            return waiting?<p>🤔 先猜一猜！回放停在碰撞前，答完就播放慢动作，再告诉你为什么。</p>
              :<>{curAi?.dj&&<div className="rp-dj">🎙 {curAi.dj}</div>}<p>{ai?(curAi?.explain||localMoment(cur,names)):'博士正在看这一段……'}</p></>;})()}
        </div>}
        {chart&&<div className="rp-chart"><RpmChart samples={decisive.samples} events={decisive.events} moments={moments} cursor={cursor} onSeek={t=>{setCursor(t);viewer.current?.seek?.(t);}} names={names} colors={[myBey.colors?.primary||'#2f7bff',opp.bey.colors?.primary||'#f2b632']}/></div>}
        {cur&&quizOn&&quizMap[cur.id]&&<QuizCard quiz={quizMap[cur.id]} answer={answers[cur.id]} onAnswer={i=>answer(cur,i)} onClose={()=>setQuizOn(false)} card={curAi.cardId&&getCard(curAi.cardId)}/>}
      </div>
      <div className="rp-strip">
        {moments.map(m=>{const a=aiM(m.id);const ans=answers[m.id];return (
          <div key={m.id} className={`rp-mpanel ${sel===m.id?'on':''}`}>
            <button className="rp-mpanel-hit" onClick={()=>play(m)}>
              <span className="rp-mnum">{NUM[m.n-1]}</span>
              <span className="rp-mtitle">{a?.title||MOMENT_TITLE[m.kind]}<small>{m.time.toFixed(1)} 秒{ans!=null?(ans===quizMap[m.id]?.answer?' · ✅':' · ❌'):quizMap[m.id]?' · 🤔':''}</small></span>
            </button>
            <div className="rp-mactions">
              <button className="btn small" onClick={()=>play(m)}>▶ 慢放</button>
              {quizMap[m.id]&&<button className="btn small" onClick={()=>{setSel(m.id);setQuizOn(true);}}>🤔 你猜</button>}
              <button className="btn small" onClick={()=>openFlipbook({moment:{kind:m.kind,title:a?.title||MOMENT_TITLE[m.kind],explain:a?.explain||localMoment(m,names)}})}>📖 绘本</button>
            </div>
          </div>);})}
        <button className="rp-mpanel rp-mnext" onClick={onNext}><span className="rp-mnum">🔬</span><span className="rp-mtitle">去实验室验证<small>只改一个变量</small></span></button>
      </div>
      <div className="model-note rp-note">复盘只引用这一局记录到的数据；因果结论都是「在这个模型里」成立。</div>
    </div>
  );
}

function QuizCard({quiz,answer,onAnswer,onClose,card}){
  const done=answer!=null;
  return <div className="rp-quiz pop-in">
    <button className="rp-quiz-x" onClick={onClose} aria-label="关闭">✕</button>
    <div className="rp-quiz-q">🤔 你猜？{quiz.q}</div>
    <div className="rp-quiz-opts">{quiz.options.map((o,i)=><button key={i} disabled={done} className={`rp-quiz-opt ${done&&i===quiz.answer?'right':''} ${done&&i===answer&&i!==quiz.answer?'wrong':''}`} onClick={()=>onAnswer(i)}><b>{'ABC'[i]}</b>{o}</button>)}</div>
    {done&&<div className="rp-quiz-reveal slidein">
      <div>{answer===quiz.answer?'✅ 答对了！🪙 +5　':'❌ 差一点！　'}{quiz.reveal||quiz.explain}</div>
      {quiz.analogy&&<div className="rp-quiz-analogy">🌏 生活里：{quiz.analogy}</div>}
      {card&&<div style={{marginTop:6}}><KnowledgeChip card={card}/></div>}
    </div>}
  </div>;
}

function NextPage({won,ai,go,myBey}){
  return (
    <div className="rp-next">
      <div className="rp-next-doc">
        <DoctorFace mood={won?'excited':'thinking'} size={110}/>
        <div className="bubble rp-next-bubble">{ai?.takeaway||(won?`漂亮！你的 ${beyTitle(myBey)} 赢下了这一场。想想是哪个设计帮了大忙？`:`没关系！输了正好做实验：只改一个零件，再比一次看看。`)}</div>
      </div>
      {/* 三个“目的地”漫画分格：用游戏里的真实美术，不用 emoji 方块；推荐的那一格盖章 */}
      {(()=>{const p=useGame.getState().params||{},bl=p.bladerId&&BLADERS.find(b=>b.id===p.bladerId),reg=p.regionId||p.region;
        const back=fromExplore()?{t:'回到探索',s:'继续寻宝，找下一个伙伴',img:`/art/regions/${reg||'harbor'}.jpg`,go:backToExplore}
          :fromVersus()?{t:'回到对战模式',s:'换个对手，或者约朋友联机',img:'/art/bg/arena.jpg',go:()=>go('versus')}
          :{t:'回到地图',s:'去别的地区冒险',img:'/art/bg/map.jpg',go:()=>go('map')};
        const panels=[{k:'back',...back,tone:'#2f7bff'},
          {k:'again',t:'再战一次',s:bl?`再挑战 ${bl.name}`:'同样的对手，再来一场',img:'/art/bg/arena.jpg',face:bl&&`/art/bladers/${bl.id}.png`,go:()=>go('battle',{...p}),tone:'#ff2d4a'},
          {k:'fuse',t:'去融合工坊改造',s:'换一片刃，设计更强的陀螺',img:'/art/bg/lab.jpg',go:()=>go('fusion',{back:'map'}),tone:'#f2b632'}];
        const rec=won?'back':'fuse';
        return <div className="rp-dest">{panels.map((d,i)=><button key={d.k} className={`rp-dest-card ${d.k===rec?'rec':''}`} style={{'--tone':d.tone,'--d':`${i*.08}s`}} onClick={()=>{sfx.clang?.(.6);d.go();}}>
          <span className="rp-dest-img" style={{backgroundImage:`url(${d.img})`}}/>
          {d.face&&<img className="rp-dest-face" src={d.face} alt=""/>}
          <span className="rp-dest-lines"/>
          {d.k===rec&&<span className="rp-dest-stamp">推荐！</span>}
          <span className="rp-dest-txt"><b>{d.t}</b><small>{d.s}</small></span>
        </button>)}</div>;})()}
    </div>
  );
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
