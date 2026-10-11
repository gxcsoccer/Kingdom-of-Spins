import {useState,useMemo,useEffect,useRef,Component} from 'react';
import {TRIALS,EXP_MAX_TIME,runExperiment} from '../game/experiment.js';
import {useTaskScope} from '../game/useTaskScope.js';
import * as ai from '../ai/client.js';
import {getCard} from '../knowledge/cards.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import {DoctorFace} from '../ui/MapScreen.jsx';
import {FINISH_ZH} from '../game/story.js';
import Workbench,{QuestionPicker,DoctorRule,QUESTIONS,VAR_LABEL} from './Workbench.jsx';
import DualReplay from './DualReplay.jsx';
import LiveTrials from './LiveTrials.jsx';
import Explain from './Explain.jsx';
import './lab.css';

const PRED=[{id:'more',label:'会更好 👍'},{id:'less',label:'会更差 👎'},{id:'same',label:'差不多 🤔'}];


function localReview({variable,prediction,stats,verdict}){
  const {A,B}=stats;
  const ok=prediction&&((prediction==='more'&&verdict==='B更好')||(prediction==='less'&&verdict==='A更好')||(prediction==='same'&&verdict==='差不多'));
  return {verdict,
    conclusion:`在这个模型里，改成「${variable.to}」后：赢了 ${B.wins}/${B.trials} 次（原来 ${A.wins}/${A.trials}），第 3 秒转速约 ${B.avgRpm3.toLocaleString()} 转（原来 ${A.avgRpm3.toLocaleString()}）。`,
    why:'只改了一个地方，其他条件都一样，所以差别就来自这个改动。',
    repeatLesson:B.wins===0||B.wins===B.trials?'3 次结果一致，说明不是运气。':'3 次结果不一样——碰撞很敏感，所以科学家要重复做实验。',
    predictionFeedback:prediction?(ok?'你猜对了！':'没猜中——这正是实验的意义！'):'下次先预测一下吧！',
    nextIdea:'试试改另一个变量？',fallback:true};
}

// Local error boundary: a rendering problem in the lab must never take down the result chapter
// (the app-level boundary would show a full-page panel / reload, which restarts the battle).
class LabBoundary extends Component{
  constructor(p){super(p);this.state={err:null,n:0};}
  static getDerivedStateFromError(err){return {err};}
  componentDidCatch(err){console.error('[lab]',err);}
  render(){
    if(!this.state.err)return <div key={this.state.n} style={{display:'contents'}}>{this.props.children}</div>;
    return <div className="lab lab-fit"><div className="lab-body" style={{placeItems:'center'}}><div className="lab-side" style={{maxWidth:420,alignItems:'center',textAlign:'center'}}>
      <b style={{fontSize:20}}>实验结果显示时出了点小问题</b><span className="lab-tip">比赛结果已经保存，不会丢失。</span>
      <button className="lab-run sm" onClick={()=>this.setState(s=>({err:null,n:s.n+1}))}>重新打开实验室</button></div></div></div>;
  }
}
export default function ExperimentLab(props){return <LabBoundary><ExperimentLabInner {...props}/></LabBoundary>;}
function ExperimentLabInner({mine,opp,launches,names,suggest,onReward,onUnlock}){
  const tasks=useTaskScope();
  const [varKey,setVarKey]=useState(null); // null = step ① (ask)
  const [change,setChange]=useState(null);
  const [pred,setPred]=useState(null);
  const [phase,setPhase]=useState('setup'); // setup | running | done
  const [progress,setProgress]=useState(0);
  const [res,setRes]=useState(null);
  const [review,setReview]=useState(null);
  const [live,setLive]=useState({A:[],B:[],n:TRIALS});
  const ruleShown=useRef(false);
  const key=change?.key, value=change?.to;
  const variable=change?{key,label:change.label,from:change.fromLabel,to:change.toLabel}:{key:varKey,label:varKey?VAR_LABEL[varKey]:'（还没选）',from:'—',to:'—'};
  useEffect(()=>{if(phase==='setup'&&!varKey&&!ruleShown.current){ruleShown.current=true;onUnlock?.(['sm-control']);}},[phase,varKey]);// eslint-disable-line

  const run=async(n=TRIALS)=>{
    if(!change)return;
    const current=tasks.begin();
    setPhase('running');setProgress(0);setReview(null);setLive({A:[],B:[],n});
    try{
    const onTrial=t=>{if(current())setLive(l=>{const arr=[...l[t.arm]];arr[t.k]=t;return {...l,[t.arm]:arr};});};
    const r=await runExperiment({mine,opp,launches,key,value,onProgress:p=>{if(current())setProgress(p);},onTrial,trials:n});
    if(!current())return;
    await new Promise(ok=>setTimeout(ok,900)); // let the last cards stamp before switching
    if(!current())return;
    setRes(r);setPhase('done');
    const payload={names,variable,prediction:pred,metric:{label:'胜场 / 第 3 秒转速',unit:'rpm'},stats:r.stats,verdict:r.verdict,
      trials:r.trials.map(t=>({A:{winner:t.A.result.winner,reason:t.A.result.reason,time:t.A.result.time,rpm3:Math.round(t.A.rpm3[0])},B:{winner:t.B.result.winner,reason:t.B.result.reason,time:t.B.result.time,rpm3:Math.round(t.B.rpm3[0])}}))};
    let rv=null;
    try{rv=ai.experiment?await ai.experiment(payload):null;}catch{}
    if(!current())return;
    rv={...localReview({variable,prediction:pred,stats:r.stats,verdict:r.verdict}),...(rv||{}),verdict:r.verdict};
    rv={...rv,predictionFeedback:`${rv.predictionFeedback||''}　🔬 完成观察 🪙 +15`};
    setReview(rv);
    // 完成观察就有奖励：鼓励认真做实验，而不是只奖励猜对。
    onReward?.(15);
    if(rv.cardId)onUnlock?.([rv.cardId]);
    }catch{if(current())setPhase('error');}
  };
  const stepN=phase!=='setup'?3:varKey?2:1;
  const chips=<div className="lab-chips">
    <span className="lab-chip c1">🔀 改变：{change?<b>{variable.label} {variable.from} → {variable.to}</b>:varKey?<b>{VAR_LABEL[varKey]}（还没改）</b>:'选一个问题'}</span>
    <span className="lab-chip c2">🔒 不变：对手 {names[1]} · 发射 · 其他零件</span>
    <span className="lab-chip c3">📏 测量：赢几次 · 第 3 秒转速</span>
  </div>;

  return (
    <div className="lab lab-fit">
      <div className="lab-head">
        <span className="h-display h-yellow lab-title">🔬 科学实验室</span>
        <span className="lab-steps">{['你想知道什么？','动手改一改','预测 · 看结果'].map((t,i)=><i key={i} className={i+1===stepN?'on':i+1<stepN?'past':''}>{['①','②','③'][i]} {t}</i>)}</span>
        {phase!=='done'&&chips}
      </div>
      {phase==='setup'&&!varKey&&<div className="lab-body lab-ask v2">
        <DoctorRule Face={<DoctorFace mood="excited" size={56}/>}/>
        <div className="lab-ask-main"><div className="lab-h">① 你想知道什么？<small>点一个问题，我们就用实验来回答它</small></div><QuestionPicker base={mine} suggestKey={suggest?.key} why={suggest?.why} onPick={k=>{setVarKey(k);setChange(null);setPred(null);}}/></div>
      </div>}
      {phase==='setup'&&varKey&&<div className="lab-body lab-tweak">
        <Workbench key={varKey} base={mine} varKey={varKey} onChange={(v,c)=>setChange(c)}/>
        <aside className="lab-side">
          <div className="lab-q">「{QUESTIONS.find(q=>q.key===varKey)?.q}」</div>
          <div className="lab-h sm">③ 先预测：改了以后会怎样？</div>
          <div className="lab-preds">{PRED.map(p=><button key={p.id} className={`lab-pred-btn ${pred===p.id?'on':''}`} onClick={()=>setPred(p.id)}>{p.label}</button>)}</div>
          <div className="lab-tip">先写下猜想，再用实验检验 · 做完观察 🪙 +15</div>
          <button className="lab-run" onClick={()=>run()} disabled={!change}>{change?'开始实验 ▶':'先动手改一改'}</button>
          <button className="lab-back" onClick={()=>{setVarKey(null);setChange(null);}}>↩ 换个问题</button>
        </aside>
      </div>}
      {phase==='running'&&<div className="lab-body lab-live">
        <div className="lab-live-h"><DoctorFace mood="thinking" size={52}/><div><b>实验中…同时跑 {live.n} 场原版 + {live.n} 场改装版</b><small>每一对比赛的发射条件完全一样，只有「{variable.label}」不同</small></div></div>
        <LiveTrials n={live.n} live={live} labels={[variable.from,variable.to]}/>
      </div>}
      {phase==='error'&&<div className="lab-body"><div className="lab-side"><b>实验暂时没跑完，请再试一次</b><button className="lab-run" onClick={()=>setPhase('setup')}>返回实验设置</button></div></div>}
      {phase==='done'&&res&&<Results res={res} review={review} variable={variable} change={change} names={names} pred={pred} mine={mine} opp={opp} onMore={()=>run(5)} onAgain={()=>{setPhase('setup');setPred(null);setChange(null);setVarKey(null);}}/>}
    </div>
  );
}

function Results({res,review,variable,change,names,pred,mine,opp,onAgain,onMore}){
  const {trials}=res;
  const beysA=useMemo(()=>[mine,opp],[mine,opp]), beysB=useMemo(()=>[res.variantBey,opp],[res.variantBey,opp]);
  // 回放第 1 次试验：它和刚才那一局发射参数完全相同，“原版”就是孩子真实打出来的那一局。
  const best=0;
  const replayRef=useRef(null);
  const fullA=trials[best]?.A?.full, fullB=trials[best]?.B?.full;
  return (
    <div className="lab-body lab-done">
      <div className="lab-dual">
        <div className="lab-dual-h">同一个发射，两种陀螺 <small>A：{variable.from} · B：{variable.to} · 第 {best+1} 次实验</small></div>
        {fullA&&fullB?<DualReplay ref={replayRef} beysA={beysA} beysB={beysB} fullA={fullA} fullB={fullB} autoplay/>:<div className="dr-empty">没有回放数据</div>}
      </div>
      <aside className="lab-side lab-res">
        <Explain change={change} mine={mine} variant={res.variantBey} res={res} review={review} onMore={onMore} onAgain={onAgain} best={best} onReplay={k=>{if(k==='diverge')replayRef.current?.jumpDivergence();}}/>
        <div className="lab-model">理想化模型结果，不代表真实比赛</div>
      </aside>
    </div>
  );
}

function OverlayChart({trials}){
  const W=480,H=150,P={l:40,r:10,t:10,b:22};
  const T=Math.max(...trials.flatMap(t=>[t.A,t.B].map(r=>r.samples.at(-1)?.time||0)),1);
  const R=Math.max(1000,...trials.flatMap(t=>[t.A,t.B].flatMap(r=>r.samples.map(s=>s.rpm[0]))));
  const x=t=>P.l+(W-P.l-P.r)*t/T, y=r=>H-P.b-(H-P.t-P.b)*r/R;
  const line=r=>r.samples.map((s,k)=>`${k?'L':'M'}${x(s.time).toFixed(1)},${y(s.rpm[0]).toFixed(1)}`).join('');
  return (
    <figure style={{margin:'12px 0 0'}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="原版和改装版你的陀螺转速对比">
        <rect x={P.l} y={P.t} width={W-P.l-P.r} height={H-P.t-P.b} fill="#fff" stroke="#111" strokeWidth="2"/>
        {[0,.5,1].map(f=><text key={f} x={P.l-5} y={y(R*f)+4} fontSize="10" textAnchor="end" fontWeight="700">{Math.round(R*f/100)*100}</text>)}
        {trials.map((t,i)=><g key={i} opacity={i?0.35:1}>
          <path d={line(t.A)} fill="none" stroke="#2f7bff" strokeWidth={i?1.5:3}/>
          <path d={line(t.B)} fill="none" stroke="#ff2d4a" strokeWidth={i?1.5:3} strokeDasharray="6 4"/>
        </g>)}
        <text x={W-P.r} y={H-6} fontSize="10" textAnchor="end" fontWeight="700">{T.toFixed(1)} 秒</text>
      </svg>
      <figcaption style={{fontSize:12,fontWeight:800,display:'flex',gap:12,flexWrap:'wrap'}}>
        <span><i style={{display:'inline-block',width:16,height:3,background:'#2f7bff',verticalAlign:'middle'}}/> A 原版你的转速</span>
        <span><i style={{display:'inline-block',width:16,height:0,borderTop:'3px dashed #ff2d4a',verticalAlign:'middle'}}/> B 改装版你的转速</span>
        <span className="muted">粗线 = 第 1 次，细线 = 第 2、3 次</span>
      </figcaption>
    </figure>
  );
}
