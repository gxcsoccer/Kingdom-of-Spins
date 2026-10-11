import {useEffect,useRef,useState} from 'react';
import BeyArt,{BeySvg} from './BeyArt.jsx';
import {Portrait,TypeBadge} from './common.jsx';
import {DoctorFace} from './MapScreen.jsx';
import {voiceSupported,listen} from '../game/voice.js';
import * as sfx from '../game/sfx.js';
import './launch.css';

export const PREDICT_CARDS=[
  {id:'ko',emoji:'💥',label:'撞飞它！',sub:'OVER / XTREME'},
  {id:'spin',emoji:'🌀',label:'比谁转得久',sub:'SPIN / 判定'},
  {id:'lose',emoji:'😰',label:'可能会输…',sub:'对手很强'},
];

// Slingshot geometry (SVG units): stadium centre (0,0), radius 100; the player launches from the left side.
const R=100, START={x:-58,y:0}, MAX_PULL=70;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** Converts a slingshot pull into the physics launch used by launchState(): rpm, speed, aim (-1..1 inward→tangential), tilt. */
export function slingToLaunch(pull){
  const len=Math.hypot(pull.x,pull.y), p=clamp(len/MAX_PULL,0,1.15), over=p>1;
  const dir=len>1?{x:-pull.x/len,y:-pull.y/len}:{x:1,y:0}; // launch goes opposite to the pull
  // Player sits at angle π: inward = +x, tangent (counter-clockwise) = -y in physics; SVG y is flipped, so tangent = +y here.
  const inward=dir.x, tang=dir.y;
  const aim=clamp(inward<=0?Math.sign(tang||1):tang,-1,1);
  const pp=Math.min(p,1);
  return {rpm:Math.round(3000+3900*pp),speed:+(.12+.42*pp).toFixed(3),aim:+aim.toFixed(2),tilt:over?13:3+3*pp,over,power:pp,dir};
}

function VsSplash({me,opp,myBey,onPick}){
  const [said,setSaid]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>{setSaid(true);sfx.say(opp.blader?.line||'来吧！','zh-CN',1.1);},700);return()=>clearTimeout(t);},[]);// eslint-disable-line
  return (
    <div className="ls-vs">
      <div className="ls-side ls-me" style={{'--c':myBey.colors?.primary||'#2f7bff'}}>
        <div className="ls-portrait">{me.avatar?<img src={`/art/avatars/${me.avatar}.png`} alt=""/>:<span className="h-display h-outline" style={{fontSize:90}}>{(me.name||'你').slice(0,1)}</span>}</div>
        <div className="ls-bey"><BeyArt bey={myBey} size={200}/></div>
        <div className="ls-name">{me.name}<small>{myBey.name}</small></div>
      </div>
      <div className="ls-side ls-opp" style={{'--c':opp.color||'#f2b632'}}>
        <div className="ls-portrait">{opp.blader?<Portrait blader={opp.blader} size={320}/>:<BeyArt bey={opp.bey} size={260}/>}</div>
        <div className="ls-bey"><BeyArt bey={opp.bey} size={200}/></div>
        <div className="ls-name">{opp.name}<small>{opp.bey.name}</small></div>
        {said&&opp.blader&&<div className="bubble ls-taunt pop">「{opp.blader.line}」</div>}
      </div>
      <div className="ls-vs-mark sfx">VS</div>
      <div className="ls-predict slidein">
        <div className="row" style={{gap:10,alignItems:'flex-end'}}><DoctorFace mood="thinking" size={64}/><div className="bubble" style={{fontSize:15}}>开打前先猜猜：你会怎么赢？</div></div>
        <div className="ls-cards">
          {PREDICT_CARDS.map(c=><button key={c.id} className="ls-card" onClick={()=>{sfx.beep(true);onPick(c.id);}}><span className="ls-emoji">{c.emoji}</span><b>{c.label}</b><small>{c.sub}</small></button>)}
          <button className="ls-skip" onClick={()=>onPick(null)}>跳过 ▶</button>
        </div>
      </div>
    </div>
  );
}

function BeyPicker({beys,value,onChange,onDone}){
  const idx=Math.max(0,beys.findIndex(b=>b.uid===value));
  const go=d=>{const n=(idx+d+beys.length)%beys.length;onChange(beys[n].uid);sfx.beep();};
  const b=beys[idx];
  return (
    <div className="ls-pick">
      <div className="h-display h-outline" style={{fontSize:40}}>选你的出战陀螺</div>
      <div className="ls-carousel">
        {beys.length>1&&<button className="ls-arrow" onClick={()=>go(-1)} aria-label="上一只">◀</button>}
        <div className="ls-pick-card pop" key={b.uid} style={{'--c':b.colors?.primary}}>
          <BeyArt bey={b} size={260}/>
          <div className="panel-title" style={{fontSize:30}}>{b.name}</div>
          <div className="row center" style={{gap:8}}><TypeBadge type={b.type||b.blade?.style}/><span className="kicker">{b.ratchet?.prongs||3}-{b.ratchet?.height||60} {b.bit}</span></div>
        </div>
        {beys.length>1&&<button className="ls-arrow" onClick={()=>go(1)} aria-label="下一只">▶</button>}
      </div>
      <div className="ls-dots">{beys.map(x=><i key={x.uid} className={x.uid===b.uid?'on':''}/>)}</div>
      <button className="btn primary big" onClick={onDone}>就用它！</button>
    </div>
  );
}

function Slingshot({myBey,oppBey,onLaunch,avatar}){
  const svg=useRef(null);
  const [pull,setPull]=useState(null); // {x,y} offset from START while dragging
  const [launched,setLaunched]=useState(false);
  const [mic,setMic]=useState(false),[heard,setHeard]=useState(''),[level,setLevel]=useState(0);
  const rec=useRef(null),audio=useRef(null),peak=useRef(0);
  const toSvg=e=>{const r=svg.current.getBoundingClientRect();return {x:((e.clientX-r.left)/r.width)*240-120,y:((e.clientY-r.top)/r.height)*240-120};};
  const down=e=>{if(launched)return;e.currentTarget.setPointerCapture?.(e.pointerId);setPull({x:0,y:0});};
  const move=e=>{if(!pull||launched)return;const p=toSvg(e);let dx=p.x-START.x,dy=p.y-START.y;const L=Math.hypot(dx,dy),M=MAX_PULL*1.15;if(L>M){dx*=M/L;dy*=M/L;}
    chargeTone(Math.min(1.15,Math.hypot(dx,dy)/MAX_PULL));setPull({x:dx,y:dy});};
  const [cut,setCut]=useState(false);
  const fire=(launch)=>{setLaunched(true);chargeTone(null);sfx.clang(1);sfx.whoosh();setCut(true);sfx.say('Go shoot!','en-US',1.25);setTimeout(()=>onLaunch(launch),1150);};
  const up=()=>{if(!pull||launched)return;const L=Math.hypot(pull.x,pull.y);if(L<8){setPull(null);chargeTone(null);return;}fire(slingToLaunch(pull));};
  useEffect(()=>()=>{rec.current?.stop();audio.current?.stop?.();},[]);
  async function toggleMic(){
    if(mic){rec.current?.stop();audio.current?.stop?.();setMic(false);return;}
    setMic(true);setHeard('');peak.current=0;
    try{ // loudness meter: louder shout = faster spin
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ctx=new AudioContext();const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();an.fftSize=512;src.connect(an);
      const buf=new Uint8Array(an.fftSize);let raf;const tick=()=>{an.getByteTimeDomainData(buf);let s=0;for(const v of buf)s+=((v-128)/128)**2;const rms=Math.sqrt(s/buf.length);const lv=clamp(rms*4,0,1);peak.current=Math.max(peak.current,lv);setLevel(lv);raf=requestAnimationFrame(tick);};tick();
      audio.current={stop:()=>{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());ctx.close();}};
    }catch{}
    rec.current=listen({lang:'en-US',onText:t=>{setHeard(t);if(/shoot|shot|shoe|chute|sure/i.test(t)){rec.current?.stop();const p=clamp(.35+peak.current*.8,.35,1);audio.current?.stop?.();setMic(false);
      fire(slingToLaunch({x:-MAX_PULL*p*.85,y:-MAX_PULL*p*.45}));}},onEnd:()=>setMic(false)});
  }
  const L=pull?slingToLaunch(pull):null;
  const bx=START.x+(pull?.x||0)*.35, by=START.y+(pull?.y||0)*.35;
  const arrow=L?{x2:START.x+L.dir.x*(30+70*L.power),y2:START.y+L.dir.y*(30+70*L.power)}:null;
  const pw=L?Math.min(1.15,Math.hypot(pull.x,pull.y)/MAX_PULL):0, aura=L?.over?'#ff2d4a':pw>.82?'#ffd400':'#29b6ff';
  return (
    <div className={`ls-launch ${pull&&!launched?'charging':''} ${L?.over?'hot':''}`} style={{'--p':pw,'--aura':aura,'--ax':`${(bx+120)/240*100}%`,'--ay':`${(by+120)/240*100}%`}}>
      <div className="ls-speedlines"/>
      <div className="ls-launch-head"><span className="h-display h-yellow" style={{fontSize:34}}>拉开发射器！</span><span className="ls-hint">按住你的陀螺往后拉，松手发射 · 拉得越远转得越快 · 方向决定冲向哪里</span></div>
      <svg ref={svg} viewBox="-120 -120 240 240" className="ls-stadium" onPointerMove={move} onPointerUp={up} onPointerLeave={up} role="img" aria-label="发射台：拖动陀螺瞄准并发射">
        <defs><pattern id="lsTone" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="rgba(0,0,0,.18)"/></pattern>
          <radialGradient id="lsAura"><stop offset="0" stopColor="#fff" stopOpacity=".95"/><stop offset=".35" stopColor={aura} stopOpacity=".75"/><stop offset="1" stopColor={aura} stopOpacity="0"/></radialGradient></defs>
        <circle r={R+8} fill="#111"/><circle r={R} fill="#f4efe2"/><circle r={R} fill="url(#lsTone)"/>
        <circle r={R*.8} fill="none" stroke="#ffd400" strokeWidth="7" strokeDasharray="4 4"/>
        <circle r={R*.38} fill="none" stroke="#111" strokeWidth="1" strokeDasharray="2 3"/>
        <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#ff2d4a" strokeWidth="3"/>
        <g transform="translate(55 0)"><g className="ls-opp-spin"><BeySvgInline bey={oppBey}/></g></g>
        {pull&&!launched&&<line x1={START.x-14} y1={START.y-16} x2={bx} y2={by} stroke="#111" strokeWidth="2.5"/>}
        {pull&&!launched&&<line x1={START.x-14} y1={START.y+16} x2={bx} y2={by} stroke="#111" strokeWidth="2.5"/>}
        {arrow&&!launched&&<g><line x1={START.x} y1={START.y} x2={arrow.x2} y2={arrow.y2} stroke={L.over?'#ff2d4a':'#2f7bff'} strokeWidth="4" strokeDasharray="8 5"/><circle cx={arrow.x2} cy={arrow.y2} r="5" fill={L.over?'#ff2d4a':'#2f7bff'} stroke="#111"/></g>}
        <g transform={`translate(${launched?START.x+ (L?.dir.x||1)*40:bx} ${launched?START.y+(L?.dir.y||0)*40:by})`} style={{transition:launched?'transform .4s ease-in':'none',cursor:'grab'}} onPointerDown={down}>
          {L&&!launched&&<g className="ls-aura-svg"><circle r={26+46*pw} fill="url(#lsAura)" style={{animation:`ls-svgpulse ${.5-.3*Math.min(pw,1)}s ease-in-out infinite alternate`}}/>
            <circle r={24+36*pw} fill="none" stroke={aura} strokeWidth={2+3*pw} strokeDasharray="3 7" className="ls-ring"/>
            <circle r={20+10*L.power} fill="none" stroke={aura} strokeWidth="4" opacity=".9"/></g>}
          <circle r="22" fill="transparent"/>
          <g className={launched?'ls-my-spin fast':'ls-my-spin'}><BeySvgInline bey={myBey}/></g>
        </g>
        {!pull&&!launched&&<text x={START.x} y={START.y+38} textAnchor="middle" fontSize="9" fontWeight="900">← 按住往后拉</text>}
      </svg>
      <div className="ls-readout">
        <div className="ls-meter"><span>转速</span><b>{L?L.rpm.toLocaleString():'—'}</b><small>RPM</small></div>
        <div className="ls-meter"><span>路线</span><b>{L?(Math.abs(L.aim)>.6?'绕场游走':Math.abs(L.aim)>.25?'斜线切入':'正面冲撞'):'—'}</b></div>
        <div className={`ls-meter ${L?.over?'warn':''}`}><span>状态</span><b>{L?(L.over?'用力过猛会歪！':L.power>.82?'完美！':'再拉远点'):'准备'}</b></div>
        {voiceSupported()&&<button className={`btn ${mic?'yellow mic-on':''}`} onClick={toggleMic} disabled={launched}>🎤 喊口令发射</button>}
      </div>
      {mic&&<div className="mic-hint">🎤 大声喊 <b>3, 2, 1, GO SHOOT!</b>（越大声转得越快）<span className="ls-vol"><i style={{width:`${Math.round(level*100)}%`}}/></span>{heard&&<span className="muted"> · 听到：{heard}</span>}</div>}
      {pull&&!launched&&<div className="ls-sfx sfx" style={{fontSize:`${60+60*pw}px`,opacity:.35+.65*Math.min(pw,1)}}>{L?.over?'ギギギ…！':'グググ…'}</div>}
      {cut&&<CutIn bey={myBey} avatar={avatar}/>}
    </div>
  );
}

// Rising charge tone while pulling (pitch follows power); null stops it.
let tone=null;
function chargeTone(p){
  try{
    if(p==null){if(tone){tone.g.gain.setTargetAtTime(0,tone.c.currentTime,.03);const t=tone;tone=null;setTimeout(()=>{t.o.stop();t.c.close();},200);}return;}
    if(sfx.isMuted())return;
    if(!tone){const c=new AudioContext(),o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';f.type='lowpass';f.frequency.value=1800;o.connect(f).connect(g).connect(c.destination);g.gain.value=0;o.start();tone={c,o,g};}
    tone.o.frequency.setTargetAtTime(90+520*p,tone.c.currentTime,.05);tone.g.gain.setTargetAtTime(.04+.06*Math.min(p,1),tone.c.currentTime,.05);
  }catch{}
}

// Anime cut-in: diagonal band with the kid's face + "GO SHOOT!!" shout.
function CutIn({bey,avatar}){
  return (
    <div className="ls-cutin" style={{'--c':bey.colors?.primary||'#2f7bff'}}>
      <div className="ls-cutin-band">
        <div className="ls-cutin-face">{avatar?<img src={`/art/avatars/${avatar}.png`} alt=""/>:<BeySvg bey={bey} size={320}/>}</div>
        <div className="ls-cutin-text sfx">GO SHOOT!!</div>
      </div>
      <div className="ls-cutin-flash"/>
    </div>
  );
}

// Embeds the 2D bey icon inside the stadium SVG (BeySvg renders its own <svg>).
function BeySvgInline({bey}){return <foreignObject x="-22" y="-22" width="44" height="44" style={{overflow:'visible'}}><div style={{width:44,height:44}}><BeySvg bey={bey} size={44}/></div></foreignObject>;}

/** Full pre-round flow. first round: VS splash (+prediction) → pick bey → slingshot. Later rounds: straight to slingshot (with a bey switch). */
export default function LaunchSequence({me,opp,beys,beyUid,setBeyUid,first,lastRound,onPredict,onLaunch,lastLabel}){
  const [step,setStep]=useState(first?'vs':'launch');
  const myBey=beys.find(b=>b.uid===beyUid)||beys[0];
  return (
    <div className="ls">
      {lastRound&&step==='launch'&&<div className="ls-last">{lastLabel}</div>}
      {step==='vs'&&<VsSplash me={me} opp={opp} myBey={myBey} onPick={p=>{onPredict(p);setStep(beys.length>1?'pick':'launch');}}/>}
      {step==='pick'&&<BeyPicker beys={beys} value={myBey.uid} onChange={setBeyUid} onDone={()=>setStep('launch')}/>}
      {step==='launch'&&<>
        <Slingshot key={myBey.uid} myBey={myBey} oppBey={opp.bey} onLaunch={onLaunch} avatar={me.avatar}/>
        {beys.length>1&&<button className="btn small ls-switch" onClick={()=>setStep('pick')}>🔁 换陀螺（{myBey.name}）</button>}
      </>}
    </div>
  );
}
