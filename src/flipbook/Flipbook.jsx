import {tr, getLocale} from '../i18n/index.js';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useTaskScope} from '../game/useTaskScope.js';
import {flipStartOnce, flipTapFree as flipTap, flipImage, markTap} from './api.js';
import {useFlipbook} from './store.js';
import ChapterBook from './ChapterBook.jsx';
import {chapterById, chapterForCard, chapterForMoment} from './chapters.js';
import {speak, stopSpeaking, ttsSupported} from '../fusion/voice.js';
import {LayerBadge} from '../knowledge/KnowledgeCard.jsx';
import './flipbook.css';

const HISTORY_KEY = 'kos.flip.history.' + getLocale();
function remember(page) {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').filter(p=>p.id!==page.id);
    h.push(page); localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-20)));
  } catch {}
}
const pageText = p => [p.title, ...p.panels.map(x=>x.text)].join('。');

/**
 * AI 科学绘本 — tap-to-explore manga picture book.
 * props: start {topic?|cardId?|bey?|moment?}, onClose(), onUnlock?(cardIds)
 */
export default function Flipbook({start, onClose, onUnlock}) {
  const tasks = useTaskScope();
  const [pages, setPages] = useState([]);        // [{page, image, tapped}]
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(true);
  const [tap, setTap] = useState(null);          // {x,y} ripple
  const [voice, setVoice] = useState(false);
  const prefetch = useRef(new Map());            // page.id → {hs, promise}
  const alive = useRef(true);
  const cur = pages[idx];
  const startKey = JSON.stringify(start||{});   // inline start objects must not re-trigger the first page

  const setImage = useCallback((id, image)=>{ if (alive.current) setPages(ps=>ps.map(e=>e.page.id===id ? {...e, image} : e)); }, []);
  const addPage = useCallback((page, tapped='', at)=>{
    setPages(ps=>[...ps.slice(0, at), {page, image:null, tapped}]);
    setIdx(at);
    onUnlock?.([page.cardId]);
    remember(page);
    flipImage(page.imagePrompt).then(img=>setImage(page.id, img || false));   // false = failed, offer redraw
  }, [onUnlock, setImage]);
  const redraw = e => { e.stopPropagation(); if (!cur) return; setImage(cur.page.id, null); flipImage(cur.page.imagePrompt).then(img=>setImage(cur.page.id, img || false)); };

  // First page.
  useEffect(()=>{
    const current = tasks.begin();
    alive.current = true; setPages([]); setIdx(0); setBusy(true); prefetch.current.clear();
    flipStartOnce(start||{}).then(page=>{ if (current()) { addPage(page, '', 0); setBusy(false); } });
    return ()=>{ alive.current = false; stopSpeaking(); };
  }, [startKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Precompute the most likely tap (first hotspot) once the image is in.
  useEffect(()=>{
    if (!cur?.image || prefetch.current.has(cur.page.id)) return;
    const hs = cur.page.hotspots[0]; if (!hs) return;
    const trail = pages.slice(0, idx+1).map(e=>e.page.title);
    const promise = markTap(cur.image, hs.x, hs.y).then(imageDataUrl=>flipTap({page:cur.page, imageDataUrl, x:hs.x, y:hs.y, trail}));
    promise.then(r=>flipImage(r.page.imagePrompt));   // warm the next image too
    prefetch.current.set(cur.page.id, {hs, promise});
  }, [cur?.image, cur?.page.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ if (voice && cur) speak(pageText(cur.page)); }, [voice, cur?.page.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const onKey = e => { if (e.key==='Escape') onClose?.(); if (e.key==='ArrowLeft') setIdx(i=>Math.max(0,i-1)); if (e.key==='ArrowRight') setIdx(i=>Math.min(pages.length-1,i+1)); };
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey);
  }, [onClose, pages.length]);

  async function onImageTap(e) {
    if (busy || !cur) return;
    const current = tasks.ticket();
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top)/r.height));
    setTap({x, y}); setBusy(true); stopSpeaking();
    const at = idx + 1, page = cur.page, trail = pages.slice(0, at).map(p=>p.page.title);
    const pre = prefetch.current.get(page.id);
    let res;
    if (pre && Math.hypot(pre.hs.x-x, pre.hs.y-y) < .1) res = await pre.promise;
    else res = await flipTap({page, imageDataUrl: await markTap(cur.image, x, y).catch(()=>null), x, y, trail});
    if (!current()) return;
    addPage(res.page, res.tapped, at);
    setTap(null); setBusy(false);
  }

  return (
    <div className="flipbook" role="dialog" aria-label={tr("AI 科学绘本")}>
      <div className="fb-top">
        <div className="row" style={{gap:12}}>
          <button className="btn small" onClick={onClose}>{tr("✕ 合上")}</button>
          <div><div className="kicker" style={{color:'#ffd400'}}>AI SCIENCE MANGA</div><div className="fb-brand">{tr("科学绘本")}</div></div>
        </div>
        <div className="row" style={{gap:8}}>
          {cur && <LayerBadge layer={cur.page.layer}/>}
          {ttsSupported && <button className="btn small" onClick={()=>{ setVoice(v=>{ if (v) stopSpeaking(); else if (cur) speak(pageText(cur.page)); return !v; }); }}>{voice?tr("🔊 朗读中"):tr("🔈 朗读")}</button>}
        </div>
      </div>

      <div className="fb-stage">
        {!cur && <div className="fb-page fb-loading"><div className="fb-doodle"/><b>{tr("博士正在翻开绘本…")}</b></div>}
        {cur && (
          <div className="fb-page fb-turn" key={cur.page.id}>
            <div className="fb-title">
              {cur.tapped && <span className="fb-tapped">👆 {cur.tapped}</span>}
              <h2>{cur.page.title}</h2>
            </div>
            <div className={`fb-art ${cur.image?'ready':''}`} onClick={onImageTap}>
              {cur.image ? <img src={cur.image} alt="" draggable={false}/>
                : cur.image===false ? <div className="fb-sketch"><span>{cur.page.title}</span><button className="btn small" onClick={redraw}>{tr("🎨 再画一次")}</button></div>
                : <div className="fb-shimmer"><span>{tr("博士正在画画…")}</span></div>}
              {cur.page.panels.map((p,i)=>(
                <div key={i} className={`fb-panel ${p.kind}`} style={{left:`${p.x*100}%`, top:`${p.y*100}%`, animationDelay:`${.15+i*.25}s`}}>{p.text}</div>
              ))}
              {cur.image && cur.page.hotspots.map((h,i)=>(
                <div key={i} className="fb-hot" style={{left:`${h.x*100}%`, top:`${h.y*100}%`, animationDelay:`${.4+i*.18}s`}}><i/><span>{h.label}</span></div>
              ))}
              {tap && <div className="fb-tap" style={{left:`${tap.x*100}%`, top:`${tap.y*100}%`}}/>}
              {busy && cur && <div className="fb-wait"><div className="fb-doodle small"/><b>{tr("博士正在翻书…")}</b></div>}
            </div>
            <div className="fb-hint">{cur.image ? tr("点画里任何你好奇的地方，翻到下一页！") : tr("画面马上就来，先读读对白～")}</div>
          </div>
        )}
      </div>

      <div className="fb-strip">
        {pages.map((e,i)=>(
          <button key={e.page.id+i} className={`fb-thumb ${i===idx?'on':''}`} onClick={()=>{ if (!busy) setIdx(i); }}>
            {e.image ? <img src={e.image} alt=""/> : <span className="fb-thumb-ph"/>}
            <span className="fb-thumb-t">{i+1}. {e.page.title}</span>
          </button>
        ))}
      </div>
      <div className="fb-note">{tr("画面由 AI 生成，只用来帮助理解；知识内容来自知识卡和游戏的理想化物理模型。")}</div>
    </div>
  );
}

// Mount once near the app root; opens whenever openFlipbook(start) is called.
export function FlipbookHost({onUnlock}) {
  const start = useFlipbook(s=>s.start), close = useFlipbook(s=>s.close);
  if (!start) return null;
  // Built-in chapter when one matches (by id, card, or replay moment); otherwise free AI exploration.
  const chapter = chapterById(start.chapter) || (start.cardId && chapterForCard(start.cardId)) || (start.moment && chapterForMoment(start.moment)) || null;
  if (chapter && !start.free) return <ChapterBook key={chapter.id+start._t} chapter={chapter} onClose={close} onUnlock={onUnlock}/>;
  return <Flipbook start={start} onClose={close} onUnlock={onUnlock}/>;
}
