import {useEffect,useMemo,useRef,useState} from 'react';
import {useGame} from '../../game/store.js';
import {FINISH_LABEL,FINISH_ZH} from '../../game/story.js';
import {commentary} from '../../ai/client.js';
import * as aiClient from '../../ai/client.js';
import {getCard} from '../../knowledge/cards.js';
import {KnowledgeChip} from '../../knowledge/KnowledgeCard.jsx';
import {findMoments} from '../../game/moments.js';
import ExperimentLab from '../../lab/ExperimentLab.jsx';
import ReplaySlot from '../ReplaySlot.jsx';
import RpmChart from '../RpmChart.jsx';
import BeyArt from '../BeyArt.jsx';
import {Portrait,Modal} from '../common.jsx';
import {DoctorFace} from '../MapScreen.jsx';
import * as sfx from '../../game/sfx.js';

const PREDICT=[{id:'ko',label:'把对手撞出界（OVER / XTREME）',match:r=>r==='over'||r==='xtreme'},{id:'spin',label:'比谁转得久（SPIN / 判定）',match:r=>r==='spin'||r==='judge'},{id:'lose',label:'我觉得会输……',match:null}];
const REWARD={normal:[120,60],pro:[160,80],super:[220,100],boss:[400,150]};
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

export default function ResultPanel({won,score,rounds,opp,blader,myBey,prediction,save,go,recordMatch,unlockCards,recruit,myName,addCoins}){
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
  const play=m=>{setActive(m.id+':'+Date.now());viewer.current?.playMoment?.(m.id);const line=aiM(m.id)?.dj;if(line)setTimeout(()=>sfx.say(line,'zh-CN',1.2),700);};
  const [answers,setAnswers]=useState({});
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
            <ReplaySlot ref={viewer} beys={[myBey,opp.bey]} samples={decisive.samples} events={decisive.events} moments={moments.map(m=>({id:m.id,time:m.time,title:aiM(m.id)?.title||MOMENT_TITLE[m.kind]}))} activeMoment={active?.split(':')[0]} onSeek={setCursor}/>
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
                {a?.dj&&<div className="dj">🎙 {a.dj}</div>}
                {a?.quiz&&<Quiz quiz={a.quiz} answer={answers[m.id]} onAnswer={i=>{setAnswers(x=>({...x,[m.id]:i}));if(i===a.quiz.answer){sfx.beep(true);addCoins(5);}else sfx.beep();if(a.cardId)unlockCards([a.cardId]);}}/>}
                {card&&(answers[m.id]!=null||!a?.quiz)&&<KnowledgeChip card={card}/>}
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

function Quiz({quiz,answer,onAnswer}){
  const done=answer!=null;
  return <div className="quiz">
    <div className="quiz-q">🤔 你猜？{quiz.q}</div>
    <div className="quiz-opts">{quiz.options.map((o,i)=><button key={i} disabled={done} className={`quiz-opt ${done&&i===quiz.answer?'right':''} ${done&&i===answer&&i!==quiz.answer?'wrong':''}`} onClick={()=>onAnswer(i)}>{'AB'[i]}. {o}</button>)}</div>
    {done&&<div className="quiz-reveal slidein">{answer===quiz.answer?'✅ 答对了！🪙 +5 ':'❌ 差一点！'}{quiz.reveal}<div className="quiz-analogy">🌏 生活里：{quiz.analogy}</div></div>}
  </div>;
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
