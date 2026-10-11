import {useEffect,useMemo,useRef,useState,lazy,Suspense} from 'react';
import {useGame,BLIND_BOX_COST,BLIND_BOX_POOL} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {TopBar,TypeBadge} from './common.jsx';
import * as sfx from '../game/sfx.js';
import './shop.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

const TAPS=3, RARE='titan';
// Short rising "charge" blip per tap (respects the game's mute).
let actx;
function blip(step){
  if(sfx.isMuted())return;
  try{actx||=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();
    const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();o.type='square';
    o.frequency.setValueAtTime(330*Math.pow(1.5,step),t);o.frequency.exponentialRampToValueAtTime(660*Math.pow(1.5,step),t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
    o.connect(g).connect(actx.destination);o.start(t);o.stop(t+.25);}catch{}
}

function Confetti({gold}){
  const bits=useMemo(()=>Array.from({length:46},(_,i)=>{const a=Math.random()*Math.PI*2,d=180+Math.random()*320;
    return {dx:Math.cos(a)*d,dy:Math.sin(a)*d-120,rot:Math.random()*720-360,c:gold?['#ffd400','#fff3a6','#ffb300','#fff'][i%4]:['#ff2d4a','#ffd400','#29b6ff','#14c9a5','#fff'][i%5],w:6+Math.random()*10,delay:Math.random()*.08};}),[gold]);
  return <div className="bx-confetti">{bits.map((b,i)=><i key={i} style={{'--dx':`${b.dx}px`,'--dy':`${b.dy}px`,'--rot':`${b.rot}deg`,background:b.c,width:b.w,height:b.w*.5,animationDelay:`${b.delay}s`}}/>)}</div>;
}

export default function ShopScreen(){
  const {save,openBlindBox,go}=useGame();
  const [stage,setStage]=useState('idle'); // idle | crack | burst | reveal
  const [taps,setTaps]=useState(0);
  const [result,setResult]=useState(null);
  const [boxOk,setBoxOk]=useState(true);
  const [nope,setNope]=useState(false);
  const rpmRef=useRef(0), timers=useRef([]);
  const total=BLIND_BOX_POOL.reduce((a,p)=>a+p.weight,0);
  const can=save.coins>=BLIND_BOX_COST;
  const rare=result?.bey?.id===RARE;
  const later=(fn,ms)=>timers.current.push(setTimeout(fn,ms));
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);

  const tap=()=>{
    if(stage!=='idle')return;
    if(!can){setNope(true);setTimeout(()=>setNope(false),600);return;}
    const n=taps+1;setTaps(n);blip(n-1);
    if(n<TAPS)return;
    const r=openBlindBox();if(!r){setTaps(0);return;}
    setResult(r);setStage('crack');sfx.clang(.55);
    later(()=>sfx.clang(.8),380);
    later(()=>{setStage('burst');sfx.clang(1);sfx.whoosh();},900);
    later(()=>{
      setStage('reveal');rpmRef.current=0;
      const t0=performance.now();const spin=()=>{const k=Math.min(1,(performance.now()-t0)/1600);rpmRef.current=5200*(1-Math.pow(1-k,3));if(k<1)requestAnimationFrame(spin);};spin();
      if(r.dup)sfx.beep(false);else{sfx.fanfare(true);sfx.say(r.bey.id===RARE?'Rare! '+r.bey.name:r.bey.name,'en-US',1.1);}
    },1350);
  };
  const again=()=>{setStage('idle');setTaps(0);setResult(null);};

  return (
    <div className="page bg-shop bx-page">
      <TopBar title="商店 · 盲盒"/>
      <div className="bx-main">
        <section className={`bx-stage s-${stage} lvl-${taps} ${rare?'rare':''}`} style={{'--lvl':taps,'--c':result?.bey?.colors?.primary||'#ffd400'}}>
          <div className="bx-rays"/>
          {(stage==='idle'||stage==='crack')&&<button className={`bx-box ${nope?'nope':''}`} onClick={tap} disabled={stage!=='idle'} aria-label="点盲盒">
            {boxOk?<img src="/art/blindbox.png" alt="盲盒" onError={()=>setBoxOk(false)} draggable={false}/>:<div className="bx-box-fallback">?</div>}
            {stage==='crack'&&<svg className="bx-cracks" viewBox="0 0 100 100"><path d="M50 8 L46 30 L55 42 L44 58 L52 75 L47 95"/><path d="M46 30 L28 36 L20 52"/><path d="M55 42 L74 46 L84 38"/><path d="M44 58 L26 70"/><path d="M52 75 L70 82"/></svg>}
            {stage==='crack'&&<span className="bx-leak"/>}
          </button>}
          {stage==='idle'&&<div className="bx-prompt">
            {can?(taps===0?<>点盲盒 <b>{TAPS}</b> 下打开！</>:<>再点 <b>{TAPS-taps}</b> 下！</>):<>金币不够啦（需要 🪙 {BLIND_BOX_COST}），去打比赛赚金币吧！</>}
            {can&&<span className="bx-cost">每盒 🪙 {BLIND_BOX_COST}</span>}
          </div>}
          {stage==='idle'&&can&&<div className="bx-pips">{Array.from({length:TAPS},(_,i)=><i key={i} className={i<taps?'on':''}/>)}</div>}
          {stage==='crack'&&<div className="bx-sfx">ピシッ…！</div>}
          {stage==='burst'&&<><div className="bx-flash"/><div className="bx-speed"/><Confetti gold={rare}/><div className="bx-sfx big">ドーン！</div></>}
          {stage==='reveal'&&result&&<div className="bx-reveal">
            <div className="bx-burst"/>
            <div className="bx-show"><Suspense fallback={null}><BeyShowcase bey={result.bey} rpmRef={rpmRef} background={false} zoom={1.15} tilt={.42}/></Suspense></div>
            {result.dup?<div className="bx-stamp dup">重复了</div>:rare?<div className="bx-stamp rare">RARE!</div>:<div className="bx-stamp new">NEW!</div>}
            <div className="bx-name"><b>{result.bey.name}</b><span>{result.bey.zh}</span></div>
            <div className="bx-meta"><TypeBadge type={result.bey.type}/>{rare&&<span className="bx-rare-tag">稀有 · 出现率 15%</span>}</div>
            {result.dup&&<div className="bx-refund">已经有这只了 · 退回 <b>🪙 40</b>{Array.from({length:5},(_,i)=><span key={i} className="bx-coin" style={{'--i':i}}>🪙</span>)}</div>}
            {!result.dup&&<div className="bx-added">已加入你的收藏！</div>}
            <div className="bx-actions">
              <button className="btn yellow" onClick={again}>{can?`再开一盒 · 🪙 ${BLIND_BOX_COST}`:'返回'}</button>
              <button className="btn" onClick={()=>go('collection')}>去看我的陀螺 ▶</button>
            </div>
          </div>}
        </section>

        <aside className="bx-side">
          <div className="panel bx-odds">
            <h3>公开概率</h3>
            {BLIND_BOX_POOL.map(p=>{const pct=Math.round(p.weight/total*100);return (
              <div key={p.id} className={`bx-odd ${p.id===RARE?'rare':''}`}>
                <img src={`/art/beys/${p.id}.png`} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>
                <span className="bx-odd-n">{BEYS[p.id].name}{p.id===RARE&&<em>稀有</em>}</span>
                <span className="bx-odd-bar"><i style={{width:`${pct*3}%`}}/></span>
                <b>{pct}%</b>
              </div>);})}
          </div>
          <div className="panel bx-rules">
            <h3>公平规则</h3>
            <ul><li>只能用打比赛赚的金币</li><li>第一盒一定出你还没有的陀螺</li><li>重复退回 40 金币</li><li>不开盲盒也能通关（AI 融合 / 探险）</li></ul>
          </div>
          <div className="panel ink bx-math"><b>数学小知识</b> Titan 15%，平均约 7 盒出 1 次——但每一盒都是独立的，第 7 盒不一定出！</div>
        </aside>
      </div>
    </div>
  );
}
