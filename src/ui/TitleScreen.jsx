import {useState} from 'react';
import {useGame} from '../game/store.js';
import AccountPanel from './AccountPanel.jsx';
import './title.css';

// Anime key-visual title: animated speed lines + screentone, two spinning hero beys with motion blur,
// big logo, and the parent login panel as a manga panel. Fits one screen.
function HeroBey({id,cls}){
  const [ok,setOk]=useState(true);
  if(!ok)return null;
  return (
    <div className={`ti-bey ${cls}`}>
      <span className="ti-bey-glow"/>
      <span className="ti-bey-ring"/>
      {[.18,.35].map((o,i)=><img key={i} className="ti-bey-ghost" style={{opacity:o,animationDelay:`${-(i+1)*.03}s`}} src={`/art/beys/${id}.png`} alt=""/>)}
      <img className="ti-bey-img" src={`/art/beys/${id}.png`} alt="" onError={()=>setOk(false)}/>
      <span className="ti-bey-streak"/>
    </div>
  );
}

export default function TitleScreen(){
  const {save,go}=useGame();
  const activeKid=useGame(s=>s.activeKid);
  const [logoOk,setLogoOk]=useState(true);
  const start=()=>go(save.collection.length?'map':'starter');
  return (
    <div className="ti">
      <div className="ti-lines"/>
      <div className="ti-tone"/>
      <HeroBey id="dragoon" cls="l"/>
      <HeroBey id="bossdragoon" cls="r"/>
      <span className="ti-sfx a">ギュイーン！</span>
      <span className="ti-sfx b">轰！</span>
      <main className="ti-main">
        <div className="ti-logo">
          {logoOk?<img src="/art/logo.png" alt="Kingdom of Spins 陀螺王国" onError={()=>setLogoOk(false)}/>:
            <h1 className="ti-logo-fallback">KINGDOM<br/>OF <span>SPINS</span><small>陀螺王国！</small></h1>}
        </div>
        {activeKid&&<div className="ti-cta">
          <button className="ti-go" onClick={start}><span>{save.collection.length?'继续冒险':'开始冒险'}</span> ▶</button>
          <button className="ti-vs" onClick={()=>go('versus')}>对战模式 ⚔</button>
          <div className="ti-hello">欢迎，<b>{activeKid.nickname}</b>！</div>
        </div>}
        <div className={`ti-account ${activeKid?'compact':''}`}><AccountPanel/></div>
      </main>
      <p className="ti-note">⚙ 对战由 MuJoCo 真实刚体物理计算 · 理想化模型，没有用真陀螺校准——能教你物理规律，不能预测真实比赛</p>
    </div>
  );
}
