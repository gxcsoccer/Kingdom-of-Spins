import {useEffect,useRef,useState,lazy,Suspense} from 'react';
import {beyTitle,beySub} from './beyName.js';
import BeyArt from './BeyArt.jsx';
import {TypeBadge} from './common.jsx';
import {DoctorFace} from './MapScreen.jsx';
import {voiceSupported,listen} from '../game/voice.js';
import * as sfx from '../game/sfx.js';
import LaunchStage3D from '../scene/LaunchStage3D.jsx';
import {SKILLS,SYNERGY,synergyOf} from '../game/team.js';
import './launch.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

export const PREDICT_CARDS=[
  {id:'ko',emoji:'💥',label:'撞飞它！',sub:'OVER / XTREME'},
  {id:'spin',emoji:'🌀',label:'比谁转得久',sub:'SPIN / 判定'},
  {id:'lose',emoji:'😰',label:'可能会输…',sub:'对手很强'},
];

// Slingshot units (unchanged from the top-down version): stadium radius 100, player on the left.
const MAX_PULL=70;
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

const beyBase=b=>(b?.id||'').includes('-')?b.id.split('-').pop():b?.id;
function BeyPic({bey,size}){
  const [ok,setOk]=useState(true);
  return ok&&!bey?.parents&&!bey?.look?<img className="ls-beypic" src={`/art/beys/${beyBase(bey)}.png`} alt={bey.name} style={{width:size}} onError={()=>setOk(false)}/>:<BeyArt bey={bey} size={size}/>;
}

// ---------- 1. VS splash: diagonal panels slam in, VS stamp, impact frame, taunt, prediction cards
function VsSplash({me,opp,myBey,onPick}){
  const [skip,setSkip]=useState(false),[said,setSaid]=useState(false);
  useEffect(()=>{
    sfx.whoosh();
    const a=setTimeout(()=>sfx.clang(1),520);
    const b=setTimeout(()=>{setSaid(true);sfx.say(opp.blader?.line||'来吧！','zh-CN',1.1);},900);
    return()=>{clearTimeout(a);clearTimeout(b);};
  },[]);// eslint-disable-line
  // opp.avatar (optional): a kid-profile avatar id, used by online versus where the opponent is another kid.
  const oppImg=opp.blader?`/art/bladers/${opp.blader.id}.png`:opp.avatar?`/art/avatars/${opp.avatar}.png`:null;
  return (
    <div className={`ls-vs ${skip?'skip':''}`} onClick={e=>{if(!e.target.closest('.ls-predict'))setSkip(true);}}>
      <div className="ls-vs-lines"/>
      <div className="ls-panel ls-me" style={{'--c':myBey.colors?.primary||'#2f7bff'}}>
        <div className="ls-panel-bg"/>
        {me.avatar?<>
          <div className="ls-figure"><img src={`/art/avatars/${me.avatar}.png`} alt=""/></div>
          <div className="ls-panel-bey"><BeyPic bey={myBey} size={190}/></div>
        </>:<div className="ls-figure bey"><BeyPic bey={myBey} size={340}/></div>}
        <div className="ls-nameplate"><b>{me.name}</b><small>{beyTitle(myBey)}</small></div>
      </div>
      <div className="ls-panel ls-opp" style={{'--c':opp.color||'#f2b632'}}>
        <div className="ls-panel-bg"/>
        <div className="ls-figure big">{oppImg?<img src={oppImg} alt=""/>:<BeyPic bey={opp.bey} size={300}/>}</div>
        <div className="ls-panel-bey"><BeyPic bey={opp.bey} size={190}/></div>
        <div className="ls-nameplate"><b>{opp.name}</b><small>{beyTitle(opp.bey)}</small></div>
        {(said||skip)&&opp.blader&&<div className="ls-taunt">「{opp.blader.line}」</div>}
      </div>
      <div className="ls-vs-flash"/>
      <div className="ls-vs-mark"><span>V</span><span>S</span></div>
      <div className="ls-predict">
        <div className="ls-predict-q"><DoctorFace mood="thinking" size={58}/><div className="ls-predict-bubble">开打前先猜猜：你会怎么赢？</div></div>
        <div className="ls-cards">
          {PREDICT_CARDS.map((c,i)=><button key={c.id} className="ls-card" style={{'--i':i}} onClick={()=>{sfx.beep(true);onPick(c.id);}}><span className="ls-emoji">{c.emoji}</span><span className="ls-card-t"><b>{c.label}</b><small>{c.sub}</small></span></button>)}
          <button className="ls-skip" onClick={()=>onPick(null)}>跳过 ▶</button>
        </div>
      </div>
      {!skip&&<div className="ls-tap">点一下跳过动画</div>}
    </div>
  );
}

// ---------- 2. bey picker (3D showcase via shared canvas)
function BeyPicker({beys,value,onChange,onDone}){
  const idx=Math.max(0,beys.findIndex(b=>b.uid===value));
  const go=d=>{const n=(idx+d+beys.length)%beys.length;onChange(beys[n].uid);sfx.beep();};
  const b=beys[idx];
  return (
    <div className="ls-pick">
      <div className="ls-pick-title">选你的出战陀螺</div>
      <div className="ls-carousel">
        {beys.length>1&&<button className="ls-arrow" onClick={()=>go(-1)} aria-label="上一只">◀</button>}
        <div className="ls-pick-card" key={b.uid} style={{'--c':b.colors?.primary}}>
          <div className="ls-pick-3d"><Suspense fallback={<BeyPic bey={b} size={230}/>}><BeyShowcase bey={b} rpm={3600} tilt={.5} zoom={1.15} background={false} standalone/></Suspense></div>
          <div className="ls-pick-name">{beyTitle(b)}{beySub(b)&&<small style={{display:'block',fontSize:'.55em',opacity:.75}}>{beySub(b)}</small>}</div>
          <div className="ls-pick-meta"><TypeBadge type={b.type||b.blade?.style}/><span>{b.ratchet?.prongs||3}-{b.ratchet?.height||60} · {b.bit}</span></div>
        </div>
        {beys.length>1&&<button className="ls-arrow" onClick={()=>go(1)} aria-label="下一只">▶</button>}
      </div>
      <div className="ls-dots">{beys.map(x=><i key={x.uid} className={x.uid===b.uid?'on':''}/>)}</div>
      <button className="ls-ok" onClick={onDone}>就用它！</button>
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
const auraOf=L=>!L?'#29b6ff':L.over?'#ff2d4a':L.power>.82?'#ffd400':'#29b6ff';
const routeOf=L=>Math.abs(L.aim)>.6?'绕场游走':Math.abs(L.aim)>.25?'斜线切入':'正面冲撞';

// ---------- 3. 3D slingshot launch
function Slingshot({myBey,oppBey,onLaunch,avatar}){
  const stateRef=useRef({pull:null,power:0,dir:null,over:false,aura:'#29b6ff',launched:null,shake:0});
  const [pull,setPull]=useState(null);
  const [launched,setLaunched]=useState(false),[cut,setCut]=useState(false);
  const [mic,setMic]=useState(false),[heard,setHeard]=useState(''),[level,setLevel]=useState(0);
  const rec=useRef(null),audio=useRef(null),peak=useRef(0);
  const L=pull?slingToLaunch(pull):null, pw=pull?Math.min(1.15,Math.hypot(pull.x,pull.y)/MAX_PULL):0;

  const update=pl=>{
    const l=pl?slingToLaunch(pl):null, p=pl?Math.min(1.15,Math.hypot(pl.x,pl.y)/MAX_PULL):0;
    Object.assign(stateRef.current,{pull:pl,power:p,dir:l?.dir||null,over:!!l?.over,aura:auraOf(l),shake:l?.over?.025:p>.82?.008:0});
    setPull(pl);
  };
  const fire=launch=>{
    if(launched)return;
    setLaunched(true);chargeTone(null);
    stateRef.current.launched={t0:performance.now(),dir:launch.dir,from:[-.09,0]};stateRef.current.shake=.06;
    sfx.clang(1);sfx.whoosh();sfx.say('Go shoot!','en-US',1.25);
    setTimeout(()=>{setCut(true);stateRef.current.shake=0;},180);
    setTimeout(()=>onLaunch(launch),1350);
  };
  const onPull=pl=>{if(launched)return;chargeTone(Math.min(1.15,Math.hypot(pl.x,pl.y)/MAX_PULL));update(pl);};
  const onRelease=pl=>{if(launched)return;if(Math.hypot(pl.x,pl.y)<8){chargeTone(null);update(null);return;}fire(slingToLaunch(pl));};

  useEffect(()=>()=>{rec.current?.stop();audio.current?.stop?.();chargeTone(null);},[]);
  async function toggleMic(){
    if(mic){rec.current?.stop();audio.current?.stop?.();setMic(false);return;}
    setMic(true);setHeard('');peak.current=0;
    try{ // loudness meter: louder shout = faster spin
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ctx=new AudioContext();const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();an.fftSize=512;src.connect(an);
      const buf=new Uint8Array(an.fftSize);let raf;const tick=()=>{an.getByteTimeDomainData(buf);let s=0;for(const v of buf)s+=((v-128)/128)**2;const rms=Math.sqrt(s/buf.length);const lv=clamp(rms*4,0,1);peak.current=Math.max(peak.current,lv);setLevel(lv);
        // live aura from loudness
        const fake={x:-MAX_PULL*lv*.85,y:-MAX_PULL*lv*.45};if(!stateRef.current.launched)update(lv>.05?fake:null);
        raf=requestAnimationFrame(tick);};tick();
      audio.current={stop:()=>{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());ctx.close();}};
    }catch{}
    rec.current=listen({lang:'en-US',onText:t=>{setHeard(t);if(/shoot|shot|shoe|chute|sure/i.test(t)){rec.current?.stop();const p=clamp(.35+peak.current*.8,.35,1);audio.current?.stop?.();setMic(false);
      fire(slingToLaunch({x:-MAX_PULL*p*.85,y:-MAX_PULL*p*.45}));}},onEnd:()=>setMic(false)});
  }

  return (
    <div className={`ls-launch ${pull&&!launched?'charging':''} ${L?.over?'hot':''} ${launched?'fired':''}`} style={{'--p':pw,'--aura':auraOf(L)}}>
      <LaunchStage3D myBey={myBey} oppBey={oppBey} stateRef={stateRef} onPull={onPull} onRelease={onRelease} disabled={launched}/>
      <div className="ls-speedlines"/>
      <div className="ls-launch-head">
        <span className="ls-launch-title">拉开发射器！</span>
        <span className="ls-hint">在场地上按住往<b>后</b>拉，松手发射 · 拉得越远转得越快 · 往左右拉决定冲向哪里</span>
      </div>
      <div className="ls-power">
        <div className="ls-power-bar"><i style={{height:`${Math.min(100,pw/1.15*100)}%`}}/><span className="ls-power-sweet"/></div>
        <div className="ls-power-l">POWER</div>
      </div>
      <div className="ls-readout">
        <div className="ls-meter"><span>转速</span><b>{L?L.rpm.toLocaleString():'—'}</b><small>RPM</small></div>
        <div className="ls-meter"><span>路线</span><b>{L?routeOf(L):'—'}</b></div>
        <div className={`ls-meter ${L?.over?'warn':''}`}><span>状态</span><b>{L?(L.over?'用力过猛会歪！':L.power>.82?'完美！':'再拉远点'):'准备'}</b></div>
        {voiceSupported()&&<button className={`ls-mic ${mic?'on':''}`} onClick={toggleMic} disabled={launched}>🎤 喊口令发射</button>}
      </div>
      {!pull&&!launched&&<div className="ls-drag-hint"><span>👆</span>按住 · 往下拉</div>}
      {mic&&<div className="ls-mic-hint">🎤 大声喊 <b>3, 2, 1, GO SHOOT!</b>（越大声转得越快）<span className="ls-vol"><i style={{width:`${Math.round(level*100)}%`}}/></span>{heard&&<span> · 听到：{heard}</span>}</div>}
      {pull&&!launched&&pw>.15&&<div className="ls-sfx" style={{fontSize:`${56+70*pw}px`,opacity:.3+.7*Math.min(pw,1)}}>{L?.over?'ギギギ…！':'グググ…'}</div>}
      {launched&&!cut&&<div className="ls-impact"/>}
      {cut&&<CutIn bey={myBey} avatar={avatar}/>}
    </div>
  );
}

// ---------- anime cut-in: eye-line band with the kid's face, speed lines, shout, whiteout
function CutIn({bey,avatar}){
  return (
    <div className="ls-cutin" style={{'--c':bey.colors?.primary||'#2f7bff'}}>
      <div className="ls-cutin-bg"/>
      <div className="ls-cutin-band thin a"/>
      <div className="ls-cutin-band main">
        <div className="ls-cutin-lines"/>
        <div className={`ls-cutin-face ${avatar?'avatar':'bey'}`}>{avatar?<img src={`/art/avatars/${avatar}.png`} alt=""/>:<BeyPic bey={bey} size={300}/>}</div>
        <div className="ls-cutin-text">GO<br/>SHOOT!!</div>
      </div>
      <div className="ls-cutin-band thin b"/>
      <div className="ls-cutin-flash"/>
    </div>
  );
}

// ---------- team: 谁上场？ (you + recruited teammates)
function TeamPicker({me,team,pilot,onPick}){
  const cur=team.find(t=>t.id===pilot);
  return (
    <div className="tp">
      <div className="tp-h">谁上场？</div>
      <div className="tp-row">
        <button className={`tp-face me ${!pilot?'on':''}`} onClick={()=>onPick(null)} aria-label="你上场">
          <span className="tp-ring"/>{me.avatar?<img src={`/art/avatars/${me.avatar}.png`} alt=""/>:<b>{(me.name||'你').slice(0,1)}</b>}<em>你</em>
        </button>
        {team.map(t=>{const sk=SKILLS[t.skill];return (
          <button key={t.id} className={`tp-face ${pilot===t.id?'on':''}`} style={{'--c':t.color}} onClick={()=>onPick(t.id)} aria-label={`${t.name}上场`}>
            <span className="tp-ring"/><img src={`/art/bladers/${t.id}.png`} alt=""/><em>{t.name}</em>
            <i className="tp-skill" title={sk.name}>{sk.icon}</i>
            {synergyOf(t.blader,t.bey)&&<i className="tp-syn">默契</i>}
          </button>);})}
      </div>
      <div className="tp-tip">{cur?<><b>{SKILLS[cur.skill].icon} {SKILLS[cur.skill].name}</b>：{SKILLS[cur.skill].short}</>:<>自己拉发射器，亲手发射！</>}</div>
    </div>
  );
}

// Teammate's turn: big portrait + specialty explained with physics; one tap → anime cut-in → auto launch.
function MateLaunch({mate,myBey,oppBey,onLaunch,makeLaunch,me,team,pilot,onPick,beys,onSwitch}){
  const stateRef=useRef({pull:null,power:0,dir:null,over:false,aura:'#ffd400',launched:null,shake:0});
  const [cut,setCut]=useState(false);
  const sk=SKILLS[mate.skill], syn=synergyOf(mate.blader,myBey);
  useEffect(()=>{sfx.whoosh();},[mate.id]);
  const go=()=>{
    if(cut)return;
    const L=makeLaunch();
    setCut(true);sfx.whoosh();sfx.clang(.8);sfx.say(`${mate.name}，${sk.name}！`,'zh-CN',1.15);
    setTimeout(()=>{stateRef.current.launched={t0:performance.now(),dir:{x:1,y:0},from:[-.09,0]};stateRef.current.shake=.06;sfx.clang(1);},1500);
    setTimeout(()=>onLaunch(L),2300);
  };
  return (
    <div className="ls-launch mate" style={{'--c':mate.color}}>
      <LaunchStage3D myBey={myBey} oppBey={oppBey} stateRef={stateRef} disabled onPull={()=>{}} onRelease={()=>{}}/>
      <div className="mt-lines"/>
      <div className="mt-hero" key={mate.id}>
        <img className="mt-hero-img" src={`/art/bladers/${mate.id}.png`} alt=""/>
        <div className="mt-hero-name">{mate.name}</div>
      </div>
      <div className="mt-card" key={'c'+mate.id}>
        <div className="mt-card-k">队员上场 · 专长</div>
        <div className="mt-card-skill">{sk.icon} {sk.name}</div>
        <p className="mt-card-why">{sk.why}</p>
        <div className="mt-card-bey">使用 <b>{beyTitle(myBey)}</b></div>
        {syn&&<div className="mt-syn"><b>默契 +{Math.round((SYNERGY-1)*100)}%</b>：他用惯了这种陀螺（发射转速 +5%）</div>}
        <button className="mt-go" onClick={go} disabled={cut}>▶ 让 {mate.name} 发射！</button>
      </div>
      {!cut&&<TeamPicker me={me} team={team} pilot={pilot} onPick={onPick}/>}
      {!cut&&beys.length>1&&<button className="ls-switch mt-switch" onClick={onSwitch}>🔁 换陀螺（{beyTitle(myBey)}）</button>}
      {cut&&<div className="ls-cutin mt-cutin" style={{'--c':mate.color}}>
        <div className="ls-cutin-bg"/>
        <div className="ls-cutin-band thin a"/>
        <div className="ls-cutin-band main">
          <div className="ls-cutin-lines"/>
          <div className="mt-cut-face"><img src={`/art/bladers/${mate.id}.png`} alt=""/></div>
          <div className="mt-cut-text"><small>{mate.name}：</small>{sk.name}！{syn&&<em>默契 +5%</em>}</div>
        </div>
        <div className="ls-cutin-band thin b"/>
        <div className="ls-cutin-flash"/>
      </div>}
    </div>
  );
}

/** Full pre-round flow. first round: VS splash (+prediction) → pick bey → slingshot. Later rounds: straight to slingshot (with a bey switch). */
export default function LaunchSequence({me,opp,beys,beyUid,setBeyUid,first,lastRound,onPredict,onLaunch,lastLabel,team=[],pilot=null,onPilot,makeMateLaunch}){
  const [step,setStep]=useState(first?'vs':'launch');
  const myBey=beys.find(b=>b.uid===beyUid)||beys[0];
  return (
    <div className="ls">
      {lastRound&&step==='launch'&&<div className="ls-last">{lastLabel}</div>}
      {step==='vs'&&<VsSplash me={me} opp={opp} myBey={myBey} onPick={p=>{onPredict(p);setStep(beys.length>1?'pick':'launch');}}/>}
      {step==='pick'&&<BeyPicker beys={beys} value={myBey.uid} onChange={setBeyUid} onDone={()=>setStep('launch')}/>}
      {step==='launch'&&(()=>{const mate=pilot&&team.find(t=>t.id===pilot);
        if(mate)return <MateLaunch key={'m'+mate.id+myBey.uid} mate={mate} myBey={myBey} oppBey={opp.bey} onLaunch={onLaunch} makeLaunch={()=>makeMateLaunch(mate)} me={me} team={team} pilot={pilot} onPick={onPilot} beys={beys} onSwitch={()=>setStep('pick')}/>;
        return <>
          <Slingshot key={myBey.uid} myBey={myBey} oppBey={opp.bey} onLaunch={onLaunch} avatar={me.avatar}/>
          {team.length>0&&<TeamPicker me={me} team={team} pilot={pilot} onPick={onPilot}/>}
          {beys.length>1&&<button className="ls-switch" onClick={()=>setStep('pick')}>🔁 换陀螺（{beyTitle(myBey)}）</button>}
        </>;})()}
    </div>
  );
}
