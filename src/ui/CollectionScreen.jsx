import {useGame,bladerById} from '../game/store.js';
import {TopBar,BeyCard,Portrait,StatBars} from './common.jsx';
import {useState} from 'react';
import {Modal} from './common.jsx';
import {lazy,Suspense} from 'react';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

const ORIGIN={starter:'初始陀螺',blindbox:'盲盒',fusion:'AI 融合',found:'奖励'};
export default function CollectionScreen(){
  const {save}=useGame();
  const [open,setOpen]=useState(null);
  const equippedBy=uid=>save.team.find(t=>t.beyUid===uid);
  return (
    <div className="page">
      <TopBar title="我的陀螺"/>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))'}}>
        {save.collection.map(b=>{const eq=equippedBy(b.uid);return (
          <BeyCard key={b.uid} bey={b} onClick={()=>setOpen(b)} tag={ORIGIN[b.origin]||null}>
            {b.parents&&<div className="muted" style={{fontWeight:800,marginTop:6}}>由 {b.parents.join(' + ')} 融合</div>}
            {eq&&<div className="badge" style={{marginTop:6,background:'var(--teal)'}}>{bladerById(eq.bladerId)?.name} 正在使用</div>}
          </BeyCard>);})}
      </div>
      {save.team.length>0&&<section className="mt2">
        <h2 className="h-display h-outline" style={{fontSize:32}}>MY TEAM</h2>
        <div className="row wrap mt">{save.team.map(t=>{const b=bladerById(t.bladerId),bey=save.collection.find(x=>x.uid===t.beyUid);return b&&(
          <div key={t.bladerId} className="panel row" style={{padding:12,gap:12}}><Portrait blader={b} size={80}/><div><div className="panel-title" style={{fontSize:20}}>{b.name}</div><div style={{fontWeight:800}}>装备：{bey?.name||'—'}</div></div></div>);})}</div>
      </section>}
      {open&&<Modal onClose={()=>setOpen(null)}>
        <div style={{height:300,border:'var(--border)'}}><Suspense fallback={null}><BeyShowcase bey={open}/></Suspense></div>
        <h2 className="h-display mt" style={{fontSize:36}}>{open.name}</h2>
        {open.lore&&<p style={{fontWeight:700,lineHeight:1.6}}>{open.lore}</p>}
        {open.why&&<p className="bubble" style={{fontSize:14}}>融合博士：{open.why}</p>}
        <StatBars bey={open}/>
      </Modal>}
    </div>
  );
}
