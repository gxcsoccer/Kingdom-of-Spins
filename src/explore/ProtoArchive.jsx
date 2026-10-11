import {useEffect,useState} from 'react';
import {prototypeOf,globePoint} from '../game/prototypes.js';
import {regionById} from '../game/regions.js';
import {useGame} from '../game/store.js';
import {flipImage} from '../flipbook/api.js';
import {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import './explore.css';

function Globe({lat,lon,size=150}){
  const [img,setImg]=useState(true);
  const p=globePoint(lat,lon,Math.max(-60,Math.min(60,lat)),lon)||{x:0,y:0};
  return (
    <div className="pa-globe" style={{width:size,height:size}}>
      {img?<img src="/art/proto/globe.png" alt="" onError={()=>setImg(false)}/>:<div className="pa-globe-css"/>}
      <div className="pa-pin" style={{left:`${50+p.x*46}%`,top:`${50-p.y*46}%`}}><i/></div>
      <div className="pa-coord">{Math.abs(lat).toFixed(1)}°{lat>=0?'N':'S'} · {Math.abs(lon).toFixed(1)}°{lon>=0?'E':'W'}</div>
    </div>
  );
}

/** 真实原型档案：<ProtoArchive regionId onClose/>. Unlocks the region's geo cards on open. */
export default function ProtoArchive({regionId,onClose}){
  const proto=prototypeOf(regionId),region=regionById(regionId);
  const [pic,setPic]=useState(`/art/proto/${regionId}.jpg`);
  const [choice,setChoice]=useState(null);
  useEffect(()=>{if(proto)useGame.getState().unlockCards(proto.cards);},[regionId]);// eslint-disable-line
  if(!proto)return null;
  const onPicError=()=>{setPic(null);flipImage(proto.imagePrompt).then(u=>setPic(u||false));};
  const c=proto.compare,done=choice!=null;
  return (
    <div className="ex-ov pa-wrap" onClick={onClose}>
      <div className="pa panel pop-in" onClick={e=>e.stopPropagation()}>
        <button className="pa-x" onClick={onClose} aria-label="关闭">✕</button>
        <div className="pa-head"><span className="kicker">REAL-WORLD ARCHIVE · 真实原型档案</span><h2>{region?.name} 的原型是……<b>{proto.name}</b></h2><div className="pa-place">📍 {proto.place} · {proto.en}</div></div>
        <div className="pa-body">
          <div className="pa-pic">{pic?<img src={pic} alt={proto.name} onError={pic.startsWith('/art')?onPicError:undefined}/>:pic===false?<div className="fb-shimmer still"><span>暂时画不出来</span></div>:<div className="fb-shimmer"><span>正在画真实的{proto.name}…</span></div>}
            <Globe lat={proto.lat} lon={proto.lon}/></div>
          <div className="pa-facts">
            <div className="ex-h">🌍 真实世界的事实</div>
            <ol>{proto.facts.map((f,i)=><li key={i}>{f}</li>)}</ol>
            <div className="pa-compare">
              <div className="ex-h">🎮 游戏 vs 🌏 现实</div>
              <div className="pa-q">{c.q}</div>
              <div className="ex-gate-opts">{c.options.map((o,i)=><button key={i} disabled={done} className={`rp-quiz-opt ${done&&i===c.answer?'right':''} ${done&&i===choice&&i!==c.answer?'wrong':''}`} onClick={()=>{setChoice(i);if(i===c.answer)useGame.getState().addCoins(15);}}><b>{'ABC'[i]}</b>{o}</button>)}</div>
              {done&&<div className="slidein pa-explain">{choice===c.answer?'✅ 答对了！🪙 +15　':'❌ 再想想！　'}{c.explain}</div>}
            </div>
            <div className="row wrap" style={{gap:6,marginTop:8}}>{proto.cards.map(id=><KnowledgeChip key={id} card={id}/>)}</div>
          </div>
        </div>
        <div className="pa-note">游戏里的地区是虚构的；这里的事实来自真实世界的地理资料。图片仅为示意。</div>
      </div>
    </div>
  );
}
