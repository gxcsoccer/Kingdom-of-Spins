import {useState} from 'react';
import {useGame} from '../game/store.js';
import {TYPE_LABEL} from '../game/beys.js';
import {beyStats,BAR_LABEL,BAR_COLOR} from '../game/stats.js';
import BeyArt,{PartLine} from './BeyArt.jsx';

export function TopBar({title,back='map',right}){
  const go=useGame(s=>s.go), coins=useGame(s=>s.save.coins);
  return (
    <div className="topbar">
      <div className="row">
        {back&&<button className="btn small" onClick={()=>go(back)}>◀ 返回</button>}
        {title&&<h1 className="h-display h-outline" style={{fontSize:'clamp(28px,4vw,44px)'}}>{title}</h1>}
      </div>
      <div className="row">{right}<span className="coins">🪙 {coins}</span></div>
    </div>
  );
}

export function StatBars({bey,compact}){
  const st=beyStats(bey);
  return (
    <div className="col" style={{gap:6}}>
      {Object.entries(st.bars).map(([k,v])=>(
        <div className="stat" key={k} style={{'--c':BAR_COLOR[k]}}><span>{BAR_LABEL[k]}</span><span className="bar"><i style={{width:`${v}%`}}/></span><span>{v}</span></div>
      ))}
      {!compact&&<div className="model-note">重量 {st.massG} g · 转动惯量 {st.inertia}×10⁻⁶ kg·m² · {st.tip}（由理想模型计算）</div>}
    </div>
  );
}

export function TypeBadge({type}){
  const color={attack:'#ff2d4a',defense:'#f2b632',stamina:'#14c9a5',balance:'#8a3cff'}[type]||'#999';
  return <span className="badge" style={{background:color,color:type==='defense'?'#111':'#fff'}}>{TYPE_LABEL[type]||type}</span>;
}

export function BeyCard({bey,onClick,selected,children,size=150,showStats=true,tag}){
  return (
    <div className="panel slidein" onClick={onClick} style={{padding:16,cursor:onClick?'pointer':'default',outline:selected?'5px solid var(--red)':'none',outlineOffset:4,background:`radial-gradient(circle at 50% 38%, ${bey.colors?.accent||'#fff'}33, transparent 60%), var(--tone-light), #fff`}}>
      {tag&&<span className="badge" style={{position:'absolute',top:-12,right:12,background:'var(--red)',color:'#fff'}}>{tag}</span>}
      <div style={{display:'grid',placeItems:'center'}}><BeyArt bey={bey} size={size}/></div>
      <div className="row between mt" style={{alignItems:'flex-start'}}>
        <div>
          <div className="panel-title" style={{fontSize:22}}>{bey.name}</div>
          {bey.zh&&<div className="muted" style={{fontWeight:800}}>{bey.zh}</div>}
        </div>
        <TypeBadge type={bey.type||bey.blade?.style}/>
      </div>
      <div style={{marginTop:4}}><PartLine bey={bey}/></div>
      {showStats&&<div className="mt"><StatBars bey={bey} compact/></div>}
      {children}
    </div>
  );
}

export function Modal({children,onClose}){
  return <div className="modal-back" onClick={onClose}><div className="panel modal pop" style={{animationName:'slidein'}} onClick={e=>e.stopPropagation()}>{children}</div></div>;
}

export function Portrait({blader,size=120}){
  const [failed,setFailed]=useState(false);
  if(!failed)return <img src={`/art/bladers/${blader.id}.png`} alt={blader.name} width={size} height={size} style={{objectFit:'cover',display:'block'}} onError={()=>setFailed(true)}/>;
  return (
    <div style={{width:size,height:size,display:'grid',placeItems:'center',background:`radial-gradient(circle at 50% 35%, ${blader.color} 0 30%, transparent 31%), radial-gradient(ellipse at 50% 110%, ${blader.color} 0 48%, transparent 49%), var(--tone), #fff`}}>
      <span className="h-display h-outline" style={{fontSize:size*.32,marginTop:-size*.12}}>{blader.name.slice(0,1)}</span>
    </div>
  );
}
