import {useState,useMemo,useEffect,useRef} from 'react';
import {TRIALS,EXP_MAX_TIME,runExperiment} from '../game/experiment.js';
import * as ai from '../ai/client.js';
import {getCard} from '../knowledge/cards.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import {DoctorFace} from '../ui/MapScreen.jsx';
import {FINISH_ZH} from '../game/story.js';
import Workbench,{QuestionPicker,DoctorRule,QUESTIONS,VAR_LABEL} from './Workbench.jsx';
import DualReplay from './DualReplay.jsx';
import './lab.css';

const PRED=[{id:'more',label:'会更好 👍'},{id:'less',label:'会更差 👎'},{id:'same',label:'差不多 🤔'}];


function localReview({variable,prediction,stats,verdict}){
  const {A,B}=stats;
  const ok=prediction&&((prediction==='more'&&verdict==='B更好')||(prediction==='less'&&verdict==='A更好')||(prediction==='same'&&verdict==='差不多'));
  return {verdict,
    conclusion:`在这个模型里，改成「${variable.to}」后：赢了 ${B.wins}/${B.trials} 次（原来 ${A.wins}/${A.trials}），第 3 秒转速约 ${B.avgRpm3.toLocaleString()} 转（原来 ${A.avgRpm3.toLocaleString()}）。`,
    why:'只改了一个地方，其他条件都一样，所以差别就来自这个改动。',
    repeatLesson:B.wins===0||B.wins===B.trials?'3 次结果一致，说明不是运气。':'3 次结果不一样——碰撞很敏感，所以科学家要重复做实验。',
    predictionFeedback:prediction?(ok?'你猜对了！🪙 +20':'没猜中，但你学到了新东西！'):'下次先预测一下吧！',
    nextIdea:'试试改另一个变量？',fallback:true};
}

export default function ExperimentLab({mine,opp,launches,names,suggest,onReward,onUnlock}){
  const [varKey,setVarKey]=useState(null); // null = step ① (ask)
  const [change,setChange]=useState(null);
  const [pred,setPred]=useState(null);
  const [phase,setPhase]=useState('setup'); // setup | running | done
  const [progress,setProgress]=useState(0);
  const [res,setRes]=useState(null);
  const [review,setReview]=useState(null);
  const ruleShown=useRef(false);
  const key=change?.key, value=change?.to;
  const variable=change?{key,label:change.label,from:change.fromLabel,to:change.toLabel}:{key:varKey,label:varKey?VAR_LABEL[varKey]:'（还没选）',from:'—',to:'—'};
  useEffect(()=>{if(phase==='setup'&&!varKey&&!ruleShown.current){ruleShown.current=true;onUnlock?.(['sm-control']);}},[phase,varKey]);// eslint-disable-line

  const run=async()=>{
    if(!change)return;
    setPhase('running');setProgress(0);setReview(null);
    const r=await runExperiment({mine,opp,launches,key,value,onProgress:setProgress});
    setRes(r);setPhase('done');
    const payload={names,variable,prediction:pred,metric:{label:'胜场 / 第 3 秒转速',unit:'rpm'},stats:r.stats,verdict:r.verdict,
      trials:r.trials.map(t=>({A:{winner:t.A.result.winner,reason:t.A.result.reason,time:t.A.result.time,rpm3:Math.round(t.A.rpm3[0])},B:{winner:t.B.result.winner,reason:t.B.result.reason,time:t.B.result.time,rpm3:Math.round(t.B.rpm3[0])}}))};
    let rv=null;
    try{rv=ai.experiment?await ai.experiment(payload):null;}catch{}
    rv={...localReview({variable,prediction:pred,stats:r.stats,verdict:r.verdict}),...(rv||{}),verdict:r.verdict};
    setReview(rv);
    const ok=pred&&((pred==='more'&&r.verdict==='B更好')||(pred==='less'&&r.verdict==='A更好')||(pred==='same'&&r.verdict==='差不多'));
    if(ok)onReward?.(20);
    if(rv.cardId)onUnlock?.([rv.cardId]);
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
          <div className="lab-tip">先写下猜想，再用实验检验 · 猜对 🪙 +20</div>
          <button className="lab-run" onClick={run} disabled={!change}>{change?'开始实验 ▶':'先动手改一改'}</button>
          <button className="lab-back" onClick={()=>{setVarKey(null);setChange(null);}}>↩ 换个问题</button>
        </aside>
      </div>}
      {phase==='running'&&<div className="lab-body lab-running">
        <DoctorFace mood="thinking" size={90}/>
        <div className="grow">
          <div className="lab-h">实验中… 同时跑 {TRIALS} 场原版 + {TRIALS} 场改装版</div>
          <div className="lab-bar"><i style={{width:`${Math.round(progress*100)}%`}}/></div>
          <div className="lab-tip">每一对比赛的发射条件完全一样，只有「{variable.label}」不同（每场最多 {EXP_MAX_TIME} 秒）</div>
        </div>
      </div>}
      {phase==='done'&&res&&<Results res={res} review={review} variable={variable} names={names} pred={pred} mine={mine} opp={opp} onAgain={()=>{setPhase('setup');setPred(null);setChange(null);setVarKey(null);}}/>}
    </div>
  );
}

function Results({res,review,variable,names,pred,mine,opp,onAgain}){
  const {stats,trials,verdict}=res;
  const [tab,setTab]=useState('doctor');
  const card=review?.cardId&&getCard(review.cardId);
  const winner=verdict==='B更好'?'B':verdict==='A更好'?'A':null;
  const beysA=useMemo(()=>[mine,opp],[mine,opp]), beysB=useMemo(()=>[res.variantBey,opp],[res.variantBey,opp]);
  const fullA=trials[0]?.A?.full, fullB=trials[0]?.B?.full;
  return (
    <div className="lab-body lab-done">
      <div className="lab-dual">
        <div className="lab-dual-h">同一个发射，两种陀螺 <small>A：{variable.from} · B：{variable.to} · 第 1 次实验</small></div>
        {fullA&&fullB?<DualReplay beysA={beysA} beysB={beysB} fullA={fullA} fullB={fullB}/>:<div className="dr-empty">没有回放数据</div>}
      </div>
      <aside className="lab-side lab-res">
        <div className={`lab-verdict v-${winner||'eq'}`}>{verdict==='B更好'?'改装版胜出！':verdict==='A更好'?'原版更强！':'差不多！'}</div>
        <table className="lab-table sm">
          <thead><tr><th></th><th className={winner==='A'?'win':''}>A 原版</th><th className={winner==='B'?'win':''}>B 改装</th></tr></thead>
          <tbody>
            <tr><th>赢几次</th><td>{stats.A.wins}/{stats.A.trials}</td><td>{stats.B.wins}/{stats.B.trials}</td></tr>
            <tr><th>第 3 秒转速</th><td>{stats.A.avgRpm3.toLocaleString()}</td><td>{stats.B.avgRpm3.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div className="lab-tabs">{[['doctor','博士结论'],['trials','3 次结果'],['chart','转速曲线']].map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t}</button>)}</div>
        <div className="lab-tabbody">
          {tab==='doctor'&&(!review?<div className="lab-tip">正在分析实验数据……</div>:<div className="lab-doc">
            <div className="lab-doc-row"><DoctorFace mood="excited" size={48}/><div className="lab-concl">{review.conclusion}</div></div>
            <div><b>为什么？</b>{review.why}</div>
            <div className="lab-repeat">🔁 {review.repeatLesson}</div>
            {pred&&<div className="lab-pred">🎯 {review.predictionFeedback}</div>}
            {card&&<KnowledgeChip card={card}/>}
          </div>)}
          {tab==='trials'&&<div className="lab-trials">{trials.map((t,i)=><div key={i} className="lab-trial"><b>第 {i+1} 次</b>
            <span className={t.A.result.winner===0?'w':'l'}>A {t.A.result.winner===0?'赢':'输'}·{FINISH_ZH[t.A.result.reason]}</span>
            <span className={t.B.result.winner===0?'w':'l'}>B {t.B.result.winner===0?'赢':'输'}·{FINISH_ZH[t.B.result.reason]}</span></div>)}
            <div className="lab-tip">平均回合 A {stats.A.avgTime}s / B {stats.B.avgTime}s · 碰撞 A {stats.A.avgHits} / B {stats.B.avgHits}</div></div>}
          {tab==='chart'&&<OverlayChart trials={trials}/>}
        </div>
        <div className="lab-res-foot"><button className="lab-run sm" onClick={onAgain}>再做一个实验</button><span className="lab-model">理想化模型结果，不代表真实比赛</span></div>
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
