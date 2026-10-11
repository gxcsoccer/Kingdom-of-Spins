import {useState} from 'react';
import {LAYER_LABEL, getCard} from './cards.js';
import '../fusion/fusion.css';

const LAYER_ICON = {official:'🏆', physics:'🔬', design:'🎮'};

export function LayerBadge({layer}) {
  return <span className={`badge ${layer}`}>{LAYER_ICON[layer]} {LAYER_LABEL[layer]||layer}</span>;
}

// Full card. `card` may be an object or an id.
export default function KnowledgeCard({card, compact=false, isNew=false}) {
  const c = typeof card==='string' ? getCard(card) : card;
  if (!c) return null;
  return (
    <div className={`kcard ${c.layer} ${compact?'compact':''} pop-soft`}>
      {isNew && <span className="kcard-new">NEW!</span>}
      <div className="row between" style={{gap:8,alignItems:'flex-start'}}>
        <div className="kcard-title">{c.title}</div>
        <LayerBadge layer={c.layer}/>
      </div>
      <p className="kcard-body">{c.body}</p>
    </div>
  );
}

// Tappable chip that expands into the full card.
export function KnowledgeChip({card, defaultOpen=false}) {
  const c = typeof card==='string' ? getCard(card) : card;
  const [open, setOpen] = useState(defaultOpen);
  if (!c) return null;
  return (
    <div className="kchip-wrap">
      <button type="button" className={`kchip ${c.layer}`} onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} aria-expanded={open}>
        <span>{LAYER_ICON[c.layer]}</span>{c.title}<span className="kchip-caret">{open?'▲':'▼'}</span>
      </button>
      {open && <KnowledgeCard card={c} compact/>}
    </div>
  );
}
