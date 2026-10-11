import {useState} from 'react';
import {CARDS, LAYER_LABEL} from './cards.js';
import KnowledgeCard from './KnowledgeCard.jsx';
import '../fusion/fusion.css';

// 知识图鉴. unlocked: array of card ids; newIds: ids to flag as NEW.
export default function Codex({unlocked=[], newIds=[], onClose}) {
  const [layer, setLayer] = useState('all');
  const got = new Set(unlocked);
  const list = CARDS.filter(c=>layer==='all'||c.layer===layer);
  const pct = Math.round(got.size / CARDS.length * 100);
  return (
    <div className="codex">
      <div className="row between wrap" style={{gap:12}}>
        <div>
          <div className="kicker">KNOWLEDGE CODEX</div>
          <h2 className="h-display h-outline" style={{fontSize:'clamp(28px,4vw,42px)'}}>知识图鉴</h2>
        </div>
        <div className="row" style={{gap:10}}>
          <div className="codex-progress"><i style={{width:`${pct}%`}}/><span>{got.size} / {CARDS.length}</span></div>
          {onClose && <button className="btn small" onClick={onClose}>✕ 关闭</button>}
        </div>
      </div>
      <div className="row wrap mt" style={{gap:8}}>
        {['all','official','physics','design'].map(k=>(
          <button key={k} className={`btn small ${layer===k?'ink':''}`} onClick={()=>setLayer(k)}>{k==='all'?'全部':LAYER_LABEL[k]}</button>
        ))}
      </div>
      <div className="codex-grid mt">
        {list.map(c=>got.has(c.id)
          ? <KnowledgeCard key={c.id} card={c} isNew={newIds.includes(c.id)}/>
          : <div key={c.id} className="kcard locked"><div className="kcard-title">？？？</div><p className="kcard-body">在对战或融合中发现这张卡！</p></div>)}
      </div>
      <p className="model-note mt">🏆 官方事实 = 真实 Beyblade X 规则与结构；🔬 物理知识 = 通用科学；🎮 游戏设定 = 陀螺王国原创 / 理想化模型。</p>
    </div>
  );
}
