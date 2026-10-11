import {useEffect,useState,lazy,Suspense} from 'react';
import {useGame,bladerById} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {TopBar,StatBars,TypeBadge} from './common.jsx';
import {BeySvg,PartLine} from './BeyArt.jsx';
import './collection.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

const ORIGIN={starter:{t:'初始',c:'#2f7bff'},blindbox:{t:'盲盒',c:'#ff2d4a'},fusion:{t:'融合',c:'#8a3cff'},explore:{t:'探索',c:'#14c9a5'},found:{t:'奖励',c:'#f2b632'}};
const PER_PAGE=8;
const baseId=b=>{if(b.parents)return b.id;const id=b.id||'';return id.includes('-')?id.split('-').pop():id;};

function BeyPic({bey,size}){
  const [ok,setOk]=useState(true);
  return ok?<img className="cw-pic" src={`/art/beys/${baseId(bey)}.png`} alt={bey.name} onError={()=>setOk(false)}/>:<div className="cw-pic svg"><BeySvg bey={bey} size={size}/></div>;
}

function Card({b,eq,onOpen,i}){
  const o=ORIGIN[b.origin]||ORIGIN.found;
  return (
    <button className="cw-card" style={{'--c':b.colors?.primary||'#888','--i':i}} onClick={onOpen}>
      <span className="cw-origin" style={{background:o.c}}>{o.t}</span>
      {eq&&<span className="cw-eq"><img src={`/art/bladers/${eq.id}.png`} alt=""/>{eq.name} 在用</span>}
      <span className="cw-art"><BeyPic bey={b} size={150}/></span>
      <span className="cw-name">{b.name}</span>
      <span className="cw-row"><TypeBadge type={b.type||b.blade?.style}/><span className="cw-parts">{b.ratchet?.prongs||3}-{b.ratchet?.height||60} · {b.bit}</span></span>
      {b.parents&&<span className="cw-fuse">{b.parents.map(p=>BEYS[p]?.name||p).join(' + ')}</span>}
    </button>
  );
}

export default function CollectionScreen(){
  const {save}=useGame();
  const [open,setOpen]=useState(null);
  const [page,setPage]=useState(0);
  const list=save.collection, pages=Math.max(1,Math.ceil(list.length/PER_PAGE));
  useEffect(()=>{if(page>=pages)setPage(pages-1);},[pages,page]);
  const shown=list.slice(page*PER_PAGE,page*PER_PAGE+PER_PAGE);
  const equippedBy=uid=>{const t=save.team.find(t=>t.beyUid===uid);return t?bladerById(t.bladerId):null;};
  const counts=Object.fromEntries(Object.keys(ORIGIN).map(k=>[k,list.filter(b=>(b.origin||'found')===k).length]));

  return (
    <div className="page cw-page">
      <TopBar title="陀螺图鉴墙" right={<span className="cw-count">共 {list.length} 只 {Object.entries(counts).filter(([,n])=>n).map(([k,n])=><em key={k} style={{background:ORIGIN[k].c}}>{ORIGIN[k].t} {n}</em>)}</span>}/>
      <div className="cw-wall">
        {pages>1&&<button className="cw-nav" disabled={page===0} onClick={()=>setPage(p=>p-1)} aria-label="上一页">◀</button>}
        <div className="cw-grid" key={page}>
          {shown.map((b,i)=><Card key={b.uid} b={b} i={i} eq={equippedBy(b.uid)} onOpen={()=>setOpen(b)}/>)}
          {!list.length&&<div className="cw-empty">还没有陀螺，去选一只初始陀螺吧！</div>}
        </div>
        {pages>1&&<button className="cw-nav" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)} aria-label="下一页">▶</button>}
      </div>
      {pages>1&&<div className="cw-dots">{Array.from({length:pages},(_,i)=><i key={i} className={i===page?'on':''} onClick={()=>setPage(i)}/>)}</div>}

      <section className="cw-team">
        <span className="cw-team-t">MY TEAM <small>{save.team.length}/3</small></span>
        {save.team.map(t=>{const bl=bladerById(t.bladerId),bey=list.find(x=>x.uid===t.beyUid);return bl&&(
          <div key={t.bladerId} className="cw-mate" style={{'--c':bl.color}}>
            <span className="cw-mate-face"><img src={`/art/bladers/${bl.id}.png`} alt=""/></span>
            <span className="cw-mate-info"><b>{bl.name}</b><small>装备</small></span>
            {bey?<span className="cw-mate-bey" title={bey.name}><BeyPic bey={bey} size={44}/><em>{bey.name}</em></span>:<em className="muted">—</em>}
          </div>);})}
        {Array.from({length:Math.max(0,3-save.team.length)},(_,i)=><div key={'e'+i} className="cw-mate empty"><span className="cw-mate-face">?</span><span className="cw-mate-info"><b>空位</b><small>打败职业对手来招募</small></span></div>)}
      </section>

      {open&&<div className="cw-modal-back" onClick={()=>setOpen(null)}>
        <div className="cw-modal" style={{'--c':open.colors?.primary||'#888'}} onClick={e=>e.stopPropagation()}>
          <button className="cw-close" onClick={()=>setOpen(null)} aria-label="关闭">✕</button>
          <div className="cw-modal-3d"><Suspense fallback={null}><BeyShowcase bey={open} rpm={3200} zoom={1.25} standalone/></Suspense></div>
          <div className="cw-modal-info">
            <span className="cw-origin big" style={{background:(ORIGIN[open.origin]||ORIGIN.found).c}}>{(ORIGIN[open.origin]||ORIGIN.found).t}</span>
            <h2>{open.name} <small>{open.zh}</small></h2>
            <div className="cw-row"><TypeBadge type={open.type||open.blade?.style}/><PartLine bey={open}/></div>
            {open.lore&&<p className="cw-lore">{open.lore}</p>}
            {open.parents&&<p className="cw-lore">由 <b>{open.parents.map(p=>BEYS[p]?.name||p).join(' + ')}</b> 融合 · 只换了 Blade</p>}
            {open.why&&<p className="cw-why">融合博士：{open.why}</p>}
            <StatBars bey={open}/>
          </div>
        </div>
      </div>}
    </div>
  );
}
