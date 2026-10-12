import {tr} from '../i18n/index.js';
import {useEffect,useRef,useState,lazy,Suspense} from 'react';
import {BEYS} from '../game/beys.js';
import {useGame} from '../game/store.js';
import AccountPanel from './AccountPanel.jsx';
import './title.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

// Anime key-visual title: animated speed lines + screentone, two spinning hero beys with motion blur,
// big logo, and the parent login panel as a manga panel. Fits one screen.
// Hero beys are the real 3D model spinning about its own axis (never a rotated 3/4-view PNG).
function HeroBey({id,cls}){
  const rpmRef=useRef(0);
  useEffect(()=>{ // ease from a stop up to cruise speed over ~3 s
    const t0=performance.now();let raf;const f=()=>{const k=Math.min(1,(performance.now()-t0)/3000);rpmRef.current=5200*(1-Math.pow(1-k,3));if(k<1)raf=requestAnimationFrame(f);};f();return()=>cancelAnimationFrame(raf);
  },[]);
  return (
    <div className={`ti-bey ${cls}`}>
      <span className="ti-bey-glow"/>
      <span className="ti-bey-streak"/>
      <Suspense fallback={null}><BeyShowcase bey={BEYS[id]} rpmRef={rpmRef} tilt={.62} zoom={1.05} background={false}/></Suspense>
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
      <span className="ti-sfx a" aria-hidden="true">ギュイーン！</span>
      <span className="ti-sfx b" aria-hidden="true">轰！</span>
      <main className="ti-main">
        <div className="ti-logo">
          {logoOk?<img src="/art/logo.png" alt={tr("Kingdom of Spins 陀螺王国")} onError={()=>setLogoOk(false)}/>:
            <h1 className="ti-logo-fallback">KINGDOM<br/>OF <span>SPINS</span></h1>}
        </div>
        {activeKid&&<div className="ti-cta">
          <button className="ti-go" onClick={start}><span>{save.collection.length?tr("继续冒险"):tr("开始冒险")}</span> ▶</button>
          <button className="ti-vs" onClick={()=>go('versus')}>{tr("对战模式 ⚔")}</button>
          <div className="ti-hello">{tr("欢迎，")}<b>{activeKid.nickname}</b>！</div>
        </div>}
        <div className={`ti-account ${activeKid?'compact':''}`}><AccountPanel/></div>
        <HeroPortrait/>
      </main>
      <p className="ti-note">{tr("⚙ 对战由 MuJoCo 真实刚体物理计算 · 理想化模型，没有用真陀螺校准——能教你物理规律，不能预测真实比赛")}</p>
    </div>
  );
}

function HeroPortrait(){
  const preview=useGame(s=>s.avatarPreview), activeKid=useGame(s=>s.activeKid);
  const p=preview||(activeKid&&/^[1-4]$/.test(String(activeKid.avatar))?{avatar:String(activeKid.avatar),name:activeKid.nickname}:null);
  if(!p||!/^[1-4]$/.test(p.avatar))return null;
  return <div className="ti-hero" key={p.avatar+p.name}>
    <div className="ti-hero-burst"/>
    <img src={`/art/avatars/${p.avatar}.png`} alt={p.name}/>
    <div className="ti-hero-name"><small>{preview&&preview.name===tr('新玩家')?tr("选这个形象？"):'BLADER'}</small><b>{p.name}</b></div>
  </div>;
}
