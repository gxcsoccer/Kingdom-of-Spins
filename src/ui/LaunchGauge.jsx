import {tr} from '../i18n/index.js';
import {useEffect,useRef,useState} from 'react';
import {voiceSupported,listen} from '../game/voice.js';
import {say} from '../game/sfx.js';
// Timing mini-game: a needle sweeps 0..1; stop it in the red zone for max power. Past the top = wobbly launch (extra tilt).
export default function LaunchGauge({onShoot}){
  const [v,setV]=useState(0);const raf=useRef();const t0=useRef(performance.now());const [locked,setLocked]=useState(null);
  useEffect(()=>{const f=()=>{const t=(performance.now()-t0.current)/1000;setV((1-Math.cos(t*2.6))/2);raf.current=requestAnimationFrame(f);};raf.current=requestAnimationFrame(f);return()=>cancelAnimationFrame(raf.current);},[]);
  const vRef=useRef(0);vRef.current=v;
  const lockedRef=useRef(null);
  const shoot=()=>{if(lockedRef.current!=null)return;cancelAnimationFrame(raf.current);const val=vRef.current;lockedRef.current=val;setLocked(val);setTimeout(()=>onShoot(val),450);};
  const [mic,setMic]=useState(false);const [heard,setHeard]=useState('');const rec=useRef(null);
  useEffect(()=>()=>rec.current?.stop(),[]);
  const toggleMic=()=>{
    if(mic){rec.current?.stop();setMic(false);return;}
    setMic(true);setHeard('');
    rec.current=listen({lang:'en-US',onText:t=>{setHeard(t);if(/shoot|shot|shoe|chute|sure/i.test(t)){rec.current?.stop();setMic(false);shoot();}},onEnd:()=>setMic(false)});
  };
  const val=locked??v, rpm=Math.round(3000+3900*Math.min(val,.95)/.95);
  const label=val>.95?tr("用力过猛！会歪"):val>.82?tr("完美！"):val>.6?tr("不错"):tr("再用力点");
  return (
    <div className="gauge">
      <div className="gauge-dial">
        <svg viewBox="-110 -110 220 130" width="260">
          <path d="M-90 0 A90 90 0 0 1 90 0" fill="none" stroke="#111" strokeWidth="26"/>
          <path d="M-90 0 A90 90 0 0 1 90 0" fill="none" stroke="#14c9a5" strokeWidth="18" strokeDasharray="283" strokeDashoffset="0" pathLength="283"/>
          <path d="M-90 0 A90 90 0 0 1 90 0" fill="none" stroke="#ffd400" strokeWidth="18" pathLength="100" strokeDasharray="0 60 22 100"/>
          <path d="M-90 0 A90 90 0 0 1 90 0" fill="none" stroke="#ff2d4a" strokeWidth="18" pathLength="100" strokeDasharray="0 82 13 100"/>
          <path d="M-90 0 A90 90 0 0 1 90 0" fill="none" stroke="#666" strokeWidth="18" pathLength="100" strokeDasharray="0 95 5 100"/>
          <g transform={`rotate(${-90+val*180})`}><path d="M-5 0 L0 -96 L5 0 Z" fill="#111"/></g>
          <circle r="12" fill="#111"/>
        </svg>
      </div>
      <div className="gauge-rpm"><span className="h-display" style={{fontSize:40}}>{rpm.toLocaleString()}</span> RPM</div>
      <div style={{fontWeight:900,color:val>.95?'var(--red)':'#111'}}>{label}</div>
      <div className="row" style={{gap:8}}>
        <button className="btn primary big" onClick={shoot} disabled={locked!=null}>GO SHOOT!</button>
        {voiceSupported()&&<button className={`btn big ${mic?'yellow mic-on':''}`} onClick={toggleMic} disabled={locked!=null} title={tr("对着麦克风喊 3, 2, 1, Go Shoot!")}>🎤</button>}
      </div>
      {mic&&<div className="mic-hint">{tr("🎤 大声喊：")}<b>3, 2, 1, GO SHOOT!</b>{heard&&<span className="muted">{tr(" · 听到：")}{heard}</span>}</div>}
      <div className="muted" style={{fontSize:12,color:'#555'}}>{tr("看准红区按下；转速越高，角动量越大")}</div>
    </div>
  );
}
