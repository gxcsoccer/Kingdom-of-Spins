import {useState} from 'react';
import {useGame,BLIND_BOX_COST,BLIND_BOX_POOL} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {TopBar,BeyCard} from './common.jsx';

export default function ShopScreen(){
  const {save,openBlindBox}=useGame();
  const [stage,setStage]=useState('idle'); // idle | shaking | reveal
  const [result,setResult]=useState(null);
  const [boxOk,setBoxOk]=useState(true);
  const total=BLIND_BOX_POOL.reduce((a,p)=>a+p.weight,0);
  const open=()=>{
    setStage('shaking');
    setTimeout(()=>{setResult(openBlindBox());setStage('reveal');},1100);
  };
  return (
    <div className="page bg-shop">
      <TopBar title="商店 · 盲盒"/>
      <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
        <div className="panel" style={{flex:'999 1 520px',minHeight:460,display:'grid',placeItems:'center',position:'relative',overflow:'hidden',padding:24}}>
          <div className="burst" style={{background:'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,212,0,.55) 0deg 4deg, transparent 4deg 12deg)'}}/>
          {stage!=='reveal'&&<div className="col" style={{alignItems:'center',position:'relative'}}>
            <div className={stage==='shaking'?'shake':''} style={{animationIterationCount:stage==='shaking'?'infinite':1}}>
              {boxOk?<img src="/art/blindbox.png" width={240} alt="盲盒" onError={()=>setBoxOk(false)}/>:
                <div style={{width:220,height:220,border:'var(--border-thick)',background:'var(--red)',boxShadow:'var(--shadow)',transform:'rotate(-6deg)',display:'grid',placeItems:'center'}}><span className="h-display h-outline" style={{fontSize:110}}>?</span></div>}
            </div>
            <button className="btn yellow big mt2" disabled={save.coins<BLIND_BOX_COST||stage==='shaking'} onClick={open}>开一盒 · 🪙 {BLIND_BOX_COST}</button>
            {save.coins<BLIND_BOX_COST&&<div className="muted mt" style={{fontWeight:800}}>金币不够啦，去打比赛赚金币吧！</div>}
          </div>}
          {stage==='reveal'&&result&&<div className="col pop" style={{alignItems:'center',position:'relative',animationName:'slidein'}}>
            <div className="sfx" style={{fontSize:56}}>{result.dup?'重复了！':'新陀螺！'}</div>
            <div style={{width:300}}><BeyCard bey={result.bey} size={200}/></div>
            <div className="muted mt" style={{fontWeight:800}}>{result.dup?'已经有这只了，退回 40 金币。':'已加入你的收藏！'}</div>
            <button className="btn mt" onClick={()=>setStage('idle')}>再看看</button>
          </div>}
        </div>
        <div className="col" style={{flex:'1 1 320px',gap:16}}>
          <div className="panel" style={{padding:18}}>
            <h3 className="panel-title" style={{fontSize:20}}>公开概率</h3>
            <div className="col mt" style={{gap:6}}>
              {BLIND_BOX_POOL.map(p=><div key={p.id} className="row between" style={{fontWeight:800}}><span>{BEYS[p.id].name} <span className="muted">{BEYS[p.id].zh}</span></span><span>{Math.round(p.weight/total*100)}%</span></div>)}
            </div>
          </div>
          <div className="panel" style={{padding:18,lineHeight:1.8,fontWeight:700}}>
            <h3 className="panel-title" style={{fontSize:20}}>公平规则</h3>
            • 只能用打比赛赚的金币<br/>• 第一盒一定出一只你还没有的陀螺<br/>• 开到重复的退回 40 金币<br/>• 不开盲盒也能通关：AI 融合也能得到新陀螺
          </div>
          <div className="panel ink" style={{padding:18,lineHeight:1.7}}>
            <div className="h-yellow h-display" style={{fontSize:20}}>数学小知识</div>
            Titan 的概率是 15%，平均大约每 7 盒出 1 次。但「平均」不代表第 7 盒一定出——每一盒都是独立的！
          </div>
        </div>
      </div>
    </div>
  );
}
