import {useState,lazy,Suspense} from 'react';
import {useGame} from '../game/store.js';
import {BEYS,STARTERS} from '../game/beys.js';
import {TypeBadge,StatBars} from './common.jsx';
import {BeySvg} from './BeyArt.jsx';
import * as sfx from '../game/sfx.js';
import './starter.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

const PART_TIP={blade:'Blade 刀刃：决定怎么撞',ratchet:'Ratchet 固锁：决定高度',bit:'Bit 轴尖：决定怎么跑'};

function Art({bey}){
  const [ok,setOk]=useState(true);
  return ok?<img className="st-png" src={`/art/beys/${bey.id}.png`} alt={bey.name} onError={()=>setOk(false)}/>:<BeySvg bey={bey} size={180}/>;
}

export default function StarterScreen(){
  const {chooseStarter,go}=useGame();
  const [pick,setPick]=useState(null);
  const [hover,setHover]=useState(null);
  const [cut,setCut]=useState(false);
  const confirm=()=>{
    if(!pick||cut)return;
    setCut(true);sfx.clang(1);sfx.whoosh();sfx.say(`${BEYS[pick].name}, I choose you!`,'en-US',1.1);
    setTimeout(()=>{chooseStarter(pick);go('map',{intro:true});},1500);
  };
  return (
    <div className="st">
      <div className="st-bg"/>
      <header className="st-head">
        <span className="st-kicker">CHAPTER 1 · 选择你的第一只陀螺</span>
        <h1 className="st-title">CHOOSE YOUR <b>PARTNER</b></h1>
        <div className="st-parts">{Object.entries(PART_TIP).map(([k,t])=><span key={k}>{t}</span>)}</div>
      </header>
      <div className="st-cards">
        {STARTERS.map((id,i)=>{const b=BEYS[id],on=pick===id,live=on||hover===id;return (
          <button key={id} className={`st-card ${on?'on':''} ${pick&&!on?'dim':''}`} style={{'--c':b.colors.primary,'--a':b.colors.accent,'--i':i}}
            onClick={()=>{setPick(id);sfx.beep(true);}} onPointerEnter={()=>setHover(id)} onPointerLeave={()=>setHover(h=>h===id?null:h)}>
            <span className="st-card-burst"/>
            <span className="st-art">{live?<Suspense fallback={<Art bey={b}/>}><BeyShowcase bey={b} rpm={on?4200:1600} zoom={1.2} background={false}/></Suspense>:<Art bey={b}/>}</span>
            <span className="st-name">{b.name}<small>{b.zh}</small></span>
            <span className="st-row"><TypeBadge type={b.type}/><span className="st-parts-l">{b.ratchet.prongs}-{b.ratchet.height} · {b.bit}</span></span>
            <span className="st-lore">{b.lore}</span>
            <span className="st-stats"><StatBars bey={b} compact/></span>
            {on&&<span className="st-stamp">就是你！</span>}
          </button>);})}
      </div>
      <footer className="st-foot">
        <button className="st-go" disabled={!pick} onClick={confirm}>{pick?<>就决定是你了，<b>{BEYS[pick].name}</b>！</>:'先点一只陀螺'}</button>
      </footer>
      {cut&&pick&&<div className="st-cut" style={{'--c':BEYS[pick].colors.primary}}>
        <div className="st-cut-band"><div className="st-cut-lines"/><span className="st-cut-art"><Art bey={BEYS[pick]}/></span><span className="st-cut-text">{BEYS[pick].name}<small>I CHOOSE YOU!!</small></span></div>
        <div className="st-cut-flash"/>
      </div>}
    </div>
  );
}
