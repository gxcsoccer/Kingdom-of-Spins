import {useState} from 'react';
import {useGame} from '../game/store.js';
import {BEYS,STARTERS} from '../game/beys.js';
import {BeyCard} from './common.jsx';

export default function StarterScreen(){
  const {chooseStarter,go}=useGame();
  const [pick,setPick]=useState(null);
  return (
    <div className="page">
      <div className="col" style={{alignItems:'center',textAlign:'center'}}>
        <div className="kicker">CHAPTER 1 · 选择你的第一只陀螺</div>
        <h1 className="h-display h-outline" style={{fontSize:'clamp(40px,6vw,72px)'}}>CHOOSE YOUR <span className="h-red">STARTER</span></h1>
        <div className="bubble" style={{maxWidth:640,marginTop:12}}>每只陀螺都由三部分组成：<b>Blade</b>（刀刃，决定怎么撞）、<b>Ratchet</b>（固锁，决定高度）、<b>Bit</b>（轴尖，决定怎么跑）。选一只最像你的！</div>
      </div>
      <div className="grid mt2" style={{gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',maxWidth:1080,margin:'40px auto 0'}}>
        {STARTERS.map(id=>(
          <BeyCard key={id} bey={BEYS[id]} size={200} selected={pick===id} onClick={()=>setPick(id)}>
            <p style={{fontWeight:700,lineHeight:1.5}}>{BEYS[id].lore}</p>
          </BeyCard>
        ))}
      </div>
      <div className="row center mt2">
        <button className="btn primary big" disabled={!pick} onClick={()=>{chooseStarter(pick);go('map',{intro:true});}}>就决定是你了！</button>
      </div>
    </div>
  );
}
