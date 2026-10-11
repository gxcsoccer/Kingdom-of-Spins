import {useEffect, useRef, useState, lazy, Suspense} from 'react';
import {CARDS, LAYER_LABEL} from './cards.js';
import KnowledgeCard, {LayerBadge} from './KnowledgeCard.jsx';
import {useGame} from '../game/store.js';
import {REGIONS} from '../game/regions.js';
import {prototypeOf} from '../game/prototypes.js';
import '../fusion/fusion.css';
const ProtoArchive = lazy(()=>import('../explore/ProtoArchive.jsx'));

const TABS = [
  {id:'official', icon:'🏆'}, {id:'physics', icon:'🔬'}, {id:'geo', icon:'🌍'}, {id:'design', icon:'🎮'}, {id:'proto', icon:'📜', label:'原型档案'},
];
const TILE_W = 220, TILE_H = 132, GAP = 12;

// Fit as many tiles as the binder page can hold (no vertical scrolling).
function usePageSize() {
  const ref = useRef(null); const [n, setN] = useState(8);
  useEffect(()=>{
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e])=>{ const {width, height} = e.contentRect;
      const cols = Math.max(1, Math.floor((width+GAP)/(TILE_W+GAP))), rows = Math.max(1, Math.floor((height+GAP)/(TILE_H+GAP))); setN(cols*rows); });
    ro.observe(el); return ()=>ro.disconnect();
  }, []);
  return [ref, n];
}

/** 知识图鉴 — paged card binder. unlocked: card ids; newIds: ids flagged NEW. */
export default function Codex({unlocked=[], newIds=[], onClose}) {
  const [tab, setTab] = useState('official');
  const [pageNo, setPageNo] = useState(0);
  const [open, setOpen] = useState(null);
  const [arch, setArch] = useState(null);
  const [gridRef, perPage] = usePageSize();
  const explore = useGame(st=>st.save.explore||{});
  const got = new Set(unlocked);
  const regionDone = r => { const e = explore[r.id]; return !!e && r.beys.every(id=>e.found?.includes(id)) && r.bladers.every(id=>e.met?.includes(id)); };
  const protoRegions = REGIONS.filter(r=>prototypeOf(r.id));
  const count = id => id==='proto' ? [protoRegions.filter(regionDone).length, protoRegions.length] : (l=>[l.filter(c=>got.has(c.id)).length, l.length])(CARDS.filter(c=>c.layer===id));
  const items = tab==='proto' ? protoRegions : CARDS.filter(c=>c.layer===tab);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const pg = Math.min(pageNo, pages-1);
  const shown = items.slice(pg*perPage, pg*perPage+perPage);
  useEffect(()=>setPageNo(0), [tab]);
  useEffect(()=>{
    const onKey = e => { if (open||arch) return; if (e.key==='ArrowRight') setPageNo(p=>Math.min(pages-1,p+1)); if (e.key==='ArrowLeft') setPageNo(p=>Math.max(0,p-1)); };
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey);
  }, [pages, open, arch]);
  const total = [got.size, CARDS.length];
  return (
    <div className="codex">
      <div className="codex-tabs">
        {TABS.map(t=>{ const [a,b] = count(t.id); return (
          <button key={t.id} className={`codex-tab ${t.id} ${tab===t.id?'on':''}`} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span>{t.label||LAYER_LABEL[t.id]}<small>{a}/{b}</small>
          </button>); })}
        <div className="codex-progress" title="全部收集进度"><i style={{width:`${Math.round(total[0]/total[1]*100)}%`}}/><span>{total[0]} / {total[1]}</span></div>
        {onClose && <button className="btn small" onClick={onClose}>✕</button>}
      </div>
      <div className="codex-binder" ref={gridRef}>
        <div key={tab+pg} className="codex-page-grid">
          {tab==='proto' ? shown.map(r=>{ const ok = regionDone(r), p = prototypeOf(r.id); return (
            <button key={r.id} className={`codex-tile proto ${ok?'':'locked'}`} disabled={!ok} onClick={()=>setArch(r.id)}>
              <div className="codex-tile-t">{ok ? p.name : '？？？'}</div>
              <div className="codex-tile-b">{ok ? `${r.name} 的真实原型 · ${p.place}` : `探索完「${r.name}」后解锁`}</div>
              <span className="codex-tile-icon">{ok?'📜':'🔒'}</span>
            </button>); })
          : shown.map(c=>got.has(c.id) ? (
            <button key={c.id} className={`codex-tile ${c.layer}`} onClick={()=>setOpen(c)}>
              {newIds.includes(c.id) && <span className="kcard-new">NEW!</span>}
              <div className="codex-tile-t">{c.title}</div>
              <div className="codex-tile-b">{c.body}</div>
            </button>
          ) : (
            <div key={c.id} className="codex-tile locked"><div className="codex-tile-t">？？？</div><div className="codex-tile-b">在对战、融合或探索中发现这张卡！</div><span className="codex-tile-icon">?</span></div>
          ))}
        </div>
      </div>
      <div className="codex-nav">
        <button className="rp-arrow" disabled={pg===0} onClick={()=>setPageNo(pg-1)} aria-label="上一页">◀</button>
        <div className="rp-dots">{Array.from({length:pages},(_,i)=><button key={i} className={i===pg?'on':''} onClick={()=>setPageNo(i)} aria-label={`第 ${i+1} 页`}/>)}</div>
        <button className="rp-arrow" disabled={pg>=pages-1} onClick={()=>setPageNo(pg+1)} aria-label="下一页">▶</button>
      </div>
      {open && <div className="modal-back" onClick={()=>setOpen(null)}><div className="codex-modal pop-in" onClick={e=>e.stopPropagation()}>
        <KnowledgeCard card={open}/>
        <button className="btn small" style={{marginTop:10}} onClick={()=>setOpen(null)}>关闭</button>
      </div></div>}
      {arch && <Suspense fallback={null}><ProtoArchive regionId={arch} onClose={()=>setArch(null)}/></Suspense>}
    </div>
  );
}
export {LayerBadge};
