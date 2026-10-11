import {useEffect,useMemo,useState} from 'react';
import {specFromBey,makePart,TIPS} from '../physics/model.js';
import {DoctorFace} from '../ui/MapScreen.jsx';
import {getCard} from '../knowledge/cards.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import {openFlipbook} from '../flipbook/store.js';
import * as sfx from '../game/sfx.js';

// Guided "原理讲解": six cards, doctor-narrated. Physics numbers are computed from the model (not AI);
// expectation / why / life text come from the AI (review.steps) when present, else per-variable templates.

const G=9.81;
function metricsOf(bey){
  const spec=specFromBey(bey),part=makePart(spec),tip=TIPS[spec.tip];
  return {
    iz:part.inertia[2]*1e6,                       // ×10⁻⁶ kg·m²
    mass:part.mass*1000,                          // g
    com:spec.tipDepth*1000,                       // mm, blade height above the tip (centre-of-gravity proxy)
    fric:.12*part.mass*G*tip.spinRadius*1e6,      // μN·m tip spin-friction torque used by the model
    contact:tip.radius*1000,                      // mm contact radius
    mu:tip.friction,
    wings:spec.wings,
  };
}
const M_DEF={
  iz:{label:'转动惯量 Iz',unit:'×10⁻⁶ kg·m²',fmt:v=>v.toFixed(2)},
  mass:{label:'总质量',unit:'g',fmt:v=>v.toFixed(1)},
  com:{label:'重心高度（离地）',unit:'mm',fmt:v=>v.toFixed(1)},
  fric:{label:'轴尖摩擦力矩',unit:'μN·m',fmt:v=>v.toFixed(0)},
  contact:{label:'轴尖接触半径',unit:'mm',fmt:v=>v.toFixed(1)},
  mu:{label:'抓地（摩擦系数）',unit:'',fmt:v=>v.toFixed(2)},
  wings:{label:'翼片数',unit:'片',fmt:v=>String(v)},
};
const SHOW={ring:['iz','mass'],bit:['fric','contact','mu'],height:['com','iz'],wings:['wings','iz']};
const CHAPTER={ring:'inertia',bit:'friction',height:'precession',wings:'momentum'};
const CARD={ring:'ph-inertia',bit:'ph-friction-area',height:'ph-com-height',wings:'ph-wing-contact'};

// Expected direction for "持久" (rpm at 3 s / round time): +1 = B should last longer, -1 = shorter, 0 = unclear.
function expectation(key,A,B){
  if(key==='ring'){const up=B.iz>A.iz;return {dir:up?1:-1,text:up
    ?`重量往外圈挪，转动惯量变大 ${pct(A.iz,B.iz)}。轴尖的摩擦力矩差不多，惯量越大，同样的摩擦让转速掉得越慢 → 预测 B 更持久，被撞时也更不容易“刹车”。`
    :`重量往中心挪，转动惯量变小 ${pct(A.iz,B.iz)}。同样的摩擦会让转速掉得更快 → 预测 B 更不持久，但更灵活、更容易加速移动。`};}
  if(key==='bit'){const less=B.fric<A.fric;return {dir:less?1:-1,text:less
    ?`新轴尖接触面更小、摩擦力矩小了 ${pct(A.fric,B.fric)}。摩擦是“偷走”转速的小偷 → 预测 B 更持久，但抓地变弱，不太会主动冲撞。`
    :`新轴尖接触面更大、摩擦力矩大了 ${pct(A.fric,B.fric)}。抓地强、跑得快、撞得猛 → 预测 B 更有攻击性，但转速掉得更快。`};}
  if(key==='height'){const up=B.com>A.com;return {dir:up?-1:1,text:up
    ?`Ratchet 变高，重心升高 ${(B.com-A.com).toFixed(1)} mm。重心越高，被撞时越容易被掀歪，歪了以后轴尖摩擦更大 → 预测 B 更容易倒、更不持久。`
    :`Ratchet 变矮，重心降低 ${(A.com-B.com).toFixed(1)} mm。重心越低站得越稳，被撞也不容易歪 → 预测 B 更稳、更持久。`};}
  const more=B.wings>A.wings;return {dir:0,text:more
    ?`翼片从 ${A.wings} 片变成 ${B.wings} 片：转一圈撞到对手的机会更多，但每片更小、每次撞击更分散。惯量变化 ${pct(A.iz,B.iz)}。→ 预测：碰撞会更频繁，谁更持久要看实验！`
    :`翼片从 ${A.wings} 片变成 ${B.wings} 片：每次撞击更集中更猛，但撞到的机会变少。惯量变化 ${pct(A.iz,B.iz)}。→ 预测：撞得更狠，持久度要看实验！`};
}
const pct=(a,b)=>{const p=Math.round((b/a-1)*100);return `${p>0?'+':''}${p}%`;};
const COMPETING={
  ring:'外圈越重，撞击时传给对手的冲量也越大，但被撞时外圈也会把能量“甩”成晃动；发射角度一点点不同，碰撞就完全不一样——碰撞的运气常常盖过惯量的好处。',
  bit:'轴尖不只影响摩擦：抓地强的轴会主动冲向对手，撞赢了对手先停；抓地弱的轴容易被撞到边缘。所以“更耐转”不一定“更会赢”。',
  height:'变高后刃的碰撞点也变了：有时正好撞到对手更低的位置把它掀飞；变矮虽稳，但也可能被对手从上面压住。',
  wings:'翼片数同时改变了形状、碰撞点和惯量，几个效果搅在一起，所以结果更难预测。',
};
const LIFE={
  ring:'花样滑冰运动员张开手臂转得慢、收起手臂转得快；自行车轮的重量在外圈，所以骑起来很稳。',
  bit:'穿冰鞋在冰上滑很久都不停，穿运动鞋在地毯上一下就停——摩擦小，运动保持得久。',
  height:'不倒翁的重心很低，怎么推都会站起来；把书高高摞起来就很容易倒。',
  wings:'电风扇的叶片越多，吹得越平稳；但每片叶子更小，单片推的风就弱。',
};

function Bars({k,A,B}){
  const d=M_DEF[k],mx=Math.max(A[k],B[k])||1,ch=A[k]?Math.round((B[k]/A[k]-1)*100):0;
  return (
    <div className="lx-bar">
      <div className="lx-bar-h"><b>{d.label}</b><em className={ch>0?'up':ch<0?'down':''}>{ch>0?'+':''}{ch}%</em></div>
      {[['A 原版',A[k],'a'],['B 改装',B[k],'b']].map(([l,v,c])=><div key={c} className={`lx-bar-row ${c}`}><span>{l}</span><span className="lx-bar-t"><i style={{width:`${Math.max(4,v/mx*100)}%`}}/></span><span className="lx-bar-v">{d.fmt(v)} <small>{d.unit}</small></span></div>)}
    </div>
  );
}

function GapChart({trials,k=0}){
  const a=trials[k]?.A?.samples||[],b=trials[k]?.B?.samples||[];
  const W=300,H=110,T=Math.max(a.at(-1)?.time||1,b.at(-1)?.time||1),R=Math.max(1000,...a.map(s=>s.rpm[0]),...b.map(s=>s.rpm[0]));
  const x=t=>6+(W-12)*t/T,y=r=>H-14-(H-22)*r/R;
  const pa=a.map(s=>[x(s.time),y(s.rpm[0])]),pb=b.map(s=>[x(s.time),y(s.rpm[0])]);
  const line=p=>p.map((q,i)=>`${i?'L':'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('');
  const gap=pa.length&&pb.length?line(pa)+pb.slice().reverse().map(q=>`L${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('')+'Z':'';
  return (
    <svg className="lx-chart" viewBox={`0 0 ${W} ${H}`}>
      <rect x="6" y="6" width={W-12} height={H-20} fill="#fff" stroke="#111" strokeWidth="2"/>
      <path d={gap} fill="rgba(255,212,0,.45)"/>
      <path d={line(pa)} fill="none" stroke="#2f7bff" strokeWidth="3"/>
      <path d={line(pb)} fill="none" stroke="#ff2d4a" strokeWidth="3" strokeDasharray="6 4"/>
      <text x="10" y={H-2} fontSize="9" fontWeight="800">0s</text><text x={W-8} y={H-2} fontSize="9" fontWeight="800" textAnchor="end">{T.toFixed(1)}s</text>
      <text x={W/2} y={H-2} fontSize="9" fontWeight="900" textAnchor="middle">第 {k+1} 次 · 蓝=A 红=B · 黄色 = 转速差</text>
    </svg>
  );
}

export default function Explain({change,mine,variant,res,review,onMore,onAgain,onReplay,best=0}){
  const [i,setI]=useState(0);
  const [voice,setVoice]=useState(false);
  const [tour,setTour]=useState(false);     // full 6-step tour (optional, auto-plays)
  const [auto,setAuto]=useState(true);
  const key=change.key, A=useMemo(()=>metricsOf(mine),[mine]), B=useMemo(()=>metricsOf(variant),[variant]);
  const {stats,trials,verdict}=res;
  const exp=expectation(key,A,B), ai=review?.steps||{};
  // Observed direction for "持久": B vs A on rpm at 3 s and round time
  const dRpm=stats.B.avgRpm3-stats.A.avgRpm3, dT=stats.B.avgTime-stats.A.avgTime;
  const obsDir=Math.abs(dRpm)>Math.max(stats.A.avgRpm3,1)*.1?Math.sign(dRpm):Math.abs(dT)>.4?Math.sign(dT):0;
  const pairs=trials.map(t=>Math.sign((t.B.result.winner===0)-(t.A.result.winner===0)));
  const mixed=new Set(trials.map(t=>t.B.result.winner)).size>1||new Set(trials.map(t=>t.A.result.winner)).size>1||(pairs.some(p=>p>0)&&pairs.some(p=>p<0));
  const agree=exp.dir!==0&&obsDir!==0&&exp.dir===obsDir;
  // ⑤ is always built from the computed data (agree / contradict / too close / mixed) so it can never contradict the numbers.
  const whyText=(
    exp.dir===0?`这次 B ${obsDir>0?'更持久':obsDir<0?'更不持久':'和 A 差不多'}。翼片的影响是好几个效果叠在一起的：${COMPETING.wings}`
    :obsDir===0?`持久度几乎没差别（第 3 秒 ${stats.A.avgRpm3.toLocaleString()} vs ${stats.B.avgRpm3.toLocaleString()} rpm）。可能这次的改动太小，被碰撞的随机性盖住了。`
    :agree?`数据和预测一致：B 第 3 秒转速 ${stats.B.avgRpm3.toLocaleString()} vs A ${stats.A.avgRpm3.toLocaleString()}，平均回合 ${stats.B.avgTime}s vs ${stats.A.avgTime}s。这说明在这个模型里，“${M_DEF[SHOW[key][0]].label}”的变化确实起了作用。`
    :`和课本预测相反！可能的原因：${COMPETING[key]}`)
    +(mixed?' 而且这 '+trials.length+' 次结果不一样——次数太少，还不能下结论，再做几次看看规律！':` 这 ${trials.length} 次结果方向一致，但在这个模型里成立，不代表真实比赛一定这样。`);
  // Short, kid-sized version of ⑤ for the conclusion view (same data logic, fewer words).
  const lbl=M_DEF[SHOW[key][0]].label;
  const whyShort=(
    exp.dir===0?`B ${obsDir>0?'转得更久':obsDir<0?'更早没力气':'和 A 差不多'}。翼片同时改变了形状、碰撞和惯量，几个效果叠在一起。`
    :obsDir===0?`两边几乎一样（第 3 秒 ${stats.A.avgRpm3.toLocaleString()} vs ${stats.B.avgRpm3.toLocaleString()} 转）。改动可能太小，被碰撞的运气盖住了。`
    :agree?`和预测一样！${lbl}变了（${pct(A[SHOW[key][0]]||1,B[SHOW[key][0]]||1)}），所以 B 第 3 秒${obsDir>0?'还剩更多':'只剩更少'}转速。`
    :`和预测相反！${COMPETING[key].split(/[；。]/)[0]}。`)
    +(mixed?` ${trials.length} 次结果不一样，再多做几次更可靠。`:'');
  const steps=[
    {t:'① 你改了什么',body:<div className="lx-change"><span className="lx-chip a">原版<b>{change.fromLabel}</b></span><b className="lx-arrow">→</b><span className="lx-chip b">改装<b>{change.toLabel}</b></span><p>其他都没变：对手、发射角度和力度、另外两个零件。</p></div>,say:`你把${change.label}从${change.fromLabel}改成了${change.toLabel}，其他都没变。`},
    {t:'② 物理上变了什么',body:<div className="lx-bars">{SHOW[key].map(k=><Bars key={k} k={k} A={A} B={B}/>)}<p className="lx-small">数字由理想化物理模型算出。</p></div>,say:`物理上，${M_DEF[SHOW[key][0]].label}变化了${pct(A[SHOW[key][0]]||1,B[SHOW[key][0]]||1)}。`},
    {t:'③ 预测会怎样',body:<p className="lx-text">{exp.text}</p>,say:exp.text},
    {t:'④ 实验看到了什么',body:<div className="lx-data">
      <table className="lab-table sm"><thead><tr><th></th><th>A 原版</th><th>B 改装</th></tr></thead><tbody>
        <tr><th>赢几次</th><td>{stats.A.wins}/{stats.A.trials}</td><td>{stats.B.wins}/{stats.B.trials}</td></tr>
        <tr><th>第 3 秒转速</th><td>{stats.A.avgRpm3.toLocaleString()}</td><td>{stats.B.avgRpm3.toLocaleString()}</td></tr>
        <tr><th>平均回合</th><td>{stats.A.avgTime}s</td><td>{stats.B.avgTime}s</td></tr></tbody></table>
      <GapChart trials={trials} k={best}/></div>,say:`实验结果：A 赢了${stats.A.wins}次，B 赢了${stats.B.wins}次。`},
    {t:'⑤ 为什么结果是这样',body:<p className="lx-text">{whyText}</p>,say:whyText},
    {t:'⑥ 生活里也一样',body:<div className="lx-life"><p className="lx-text">🌏 {ai.life||LIFE[key]}</p>
      <div className="lx-life-row">{getCard(CARD[key])&&<KnowledgeChip card={getCard(CARD[key])}/>}<button className="lx-btn" onClick={()=>openFlipbook({chapter:CHAPTER[key]})}>📖 翻开绘本</button><button className="lx-btn more" onClick={onMore}>🔁 再做 5 次看看</button></div></div>,say:ai.life||LIFE[key]},
  ];
  const cur=steps[i];
  // Tour: auto-advance every ~4.5 s (longer cards a bit more); say each card if voice is on; drive the replay.
  useEffect(()=>{
    if(!tour)return;
    if(voice&&!sfx.isMuted())sfx.say(String(cur.say).replace(/[\u{1F300}-\u{1FAFF}]/gu,''),'zh-CN',1.05);
    if(i===3)onReplay?.('diverge');
    if(!auto||i>=steps.length-1)return;
    const t=setTimeout(()=>setI(x=>Math.min(steps.length-1,x+1)),Math.max(4500,String(cur.say).length*(voice?230:120)));
    return()=>clearTimeout(t);
  },[tour,i,auto,voice]);// eslint-disable-line
  useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
  const mood=i===4?(agree?'excited':'thinking'):i===5?'excited':'normal';
  const V=verdict==='B更好'?{cls:'B',t:'改装更强！',icon:'⬆'}:verdict==='A更好'?{cls:'A',t:'原版更强',icon:'⬇'}:{cls:'eq',t:'差不多',icon:'≈'};
  const arrow=(a,b)=>b>a?'up':b<a?'down':'same';
  const card=getCard(CARD[key]);
  const life=ai.life||LIFE[key];

  if(!tour)return (
    <div className="lx lx-sum">
      <div className={`lx-board v-${V.cls}`}><b>{V.t}</b><span className="lx-board-i">{V.icon}</span></div>
      <div className="lx-nums">
        <div className="lx-num"><small>赢的次数</small><span>A <b>{stats.A.wins}/{stats.A.trials}</b></span><i className={arrow(stats.A.wins,stats.B.wins)}>→</i><span>B <b>{stats.B.wins}/{stats.B.trials}</b></span></div>
        <div className="lx-num"><small>第 3 秒转速</small><span>A <b>{stats.A.avgRpm3.toLocaleString()}</b></span><i className={arrow(stats.A.avgRpm3*1.05,stats.B.avgRpm3)}>→</i><span>B <b>{stats.B.avgRpm3.toLocaleString()}</b></span></div>
      </div>
      <div className="lx-why"><div className="lx-why-h"><DoctorFace mood={agree?'excited':'thinking'} size={40}/><b>为什么？</b></div><p>{whyShort}</p><p className="lx-life-l">🌏 {life}</p></div>
      <div className="lx-learn">
        {card&&<KnowledgeChip card={card}/>}
        <button className="lx-big" onClick={()=>openFlipbook({chapter:CHAPTER[key]})}>📖 翻开绘本</button>
      </div>
      <div className="lx-acts">
        <button className="lx-big go" onClick={()=>{setI(0);setAuto(true);setTour(true);}}>▶ 博士带你看<span className="lx-long">完整</span>讲解</button>
        <button className="lx-big" onClick={onAgain}>换个问题<span className="lx-long">再实验</span></button>
      </div>
    </div>
  );
  return (
    <div className="lx lx-tour">
      <div className={`lx-verdict v-${V.cls}`}>{V.t} {V.icon}<small>完整讲解 {i+1}/6</small></div>
      <div className="lx-card" key={i}>
        <div className="lx-card-h"><DoctorFace mood={mood} size={44}/><b>{cur.t}</b></div>
        <div className="lx-card-b">{cur.body}</div>
        {auto&&i<steps.length-1&&<div className="lx-timer" key={'t'+i}/>}
      </div>
      <div className="lx-nav">
        <button onClick={()=>{setAuto(false);setI(x=>Math.max(0,x-1));}} disabled={i===0}>◀</button>
        <button onClick={()=>setAuto(a=>!a)}>{auto?'⏸':'▶'}</button>
        <span className="lx-dots">{steps.map((_,k)=><i key={k} className={k===i?'on':k<i?'past':''} onClick={()=>{setAuto(false);setI(k);}}/>)}</span>
        <button className="next" onClick={()=>{setAuto(false);setI(x=>Math.min(steps.length-1,x+1));}} disabled={i===steps.length-1}>▶</button>
        <button className={`lx-voice ${voice?'on':''}`} onClick={()=>{setVoice(v=>!v);window.speechSynthesis?.cancel();}} title="朗读">{voice?'🔊':'🔈'}</button>
        <button className="lx-close" onClick={()=>{window.speechSynthesis?.cancel();setTour(false);}}>✕ 回到结论</button>
      </div>
    </div>
  );
}
