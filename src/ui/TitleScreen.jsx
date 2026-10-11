import {useState} from 'react';
import {useGame} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {BeySvg} from './BeyArt.jsx';
import AccountPanel from './AccountPanel.jsx';

export default function TitleScreen(){
  const {save,go}=useGame();
  const activeKid=useGame(s=>s.activeKid);
  const [logoOk,setLogoOk]=useState(true);
  const start=()=>go(save.collection.length?'map':'starter');
  return (
    <div className="page" style={{minHeight:'100vh',display:'grid',placeItems:'center',overflow:'hidden'}}>
      <div className="burst"/>
      <div style={{position:'absolute',left:'-6%',top:'8%',opacity:.95,transform:'rotate(-12deg)'}}><BeySvg bey={BEYS.dragoon} size={300} spin/></div>
      <div style={{position:'absolute',right:'-5%',bottom:'4%',opacity:.95,transform:'rotate(10deg)'}}><BeySvg bey={BEYS.bossdragoon} size={340} spin/></div>
      <div className="col" style={{alignItems:'center',position:'relative',zIndex:2,textAlign:'center'}}>
        {logoOk?<img src="/art/logo.png" alt="Kingdom of Spins" style={{width:'min(720px,90vw)'}} onError={()=>setLogoOk(false)}/>:
          <div>
            <div className="kicker" style={{fontSize:16}}>AI × BEYBLADE X × SCIENCE</div>
            <h1 className="h-display h-outline" style={{fontSize:'clamp(56px,10vw,128px)'}}>KINGDOM<br/>OF <span className="h-red">SPINS</span></h1>
            <div className="sfx" style={{fontSize:'clamp(32px,5vw,56px)',marginTop:8}}>陀螺王国！</div>
          </div>}
        {activeKid&&<div className="row mt2 wrap center">
          <button className="btn primary big" onClick={start}>{save.collection.length?'继续冒险 ▶':'开始冒险 ▶'}</button>
          <button className="btn big" onClick={()=>go('versus')}>对战模式 ⚔</button>
        </div>}
        {activeKid&&<div style={{fontWeight:900,marginTop:6}}>欢迎，{activeKid.nickname}！</div>}
        <AccountPanel/>
        <p className="model-note" style={{maxWidth:520}}>对战由 MuJoCo 真实刚体物理计算。这是理想化模型，没有用真陀螺校准过——它能教你物理规律，但不能预测真实比赛。</p>
      </div>
    </div>
  );
}
