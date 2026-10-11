import {useEffect, useMemo, useRef, useState} from 'react';
import {bookArt} from './chapters.js';
import {EXPERIMENTS} from './experiments.jsx';
import {flipImage, flipTap, markTap} from './api.js';   // flipImage: only for missing main-page art
import {labQuiz} from './labquiz.js';
import {getSeen, markSeen, pickQuiz} from '../knowledge/quizSeen.js';
import {getCard} from '../knowledge/cards.js';
import {speak, stopSpeaking, ttsSupported} from '../fusion/voice.js';
import '../ui/result/result.css';
import './flipbook.css';

const NUM = '①②③④⑤⑥';
const KIND_LABEL = {hook:'提出问题', observe:'仔细观察', analogy:'生活里的例子', experiment:'动手实验', quiz:'小测验', wrap:'总结'};

// Hotspots are located by vision on the image that is actually shown (cached per image).
async function toDataUrl(src, max=768) {
  if (src.startsWith('data:')) { return await markTap(src, -1, -1, max); }
  const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
  const k = Math.min(1, max/Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .82);
}
const spotKey = key => 'kos.spots2.' + key.slice(0, 120);   // v2: every hotspot carries one of this chapter's cards
const locating = new Map();
export function locateSpots(key, src, context, chapter) {
  try { const hit = localStorage.getItem(spotKey(key)); if (hit) return Promise.resolve(JSON.parse(hit)); } catch {}
  if (!locating.has(key)) locating.set(key, (async()=>{
    const imageDataUrl = await toDataUrl(src);
    const r = await fetch('/api/ai/flip/locate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({imageDataUrl, context, chapter: chapter && {id:chapter.id, cards:chapter.cards, question:chapter.question, title:chapter.title}})}).then(x=>x.json()).catch(()=>({spots:[]}));
    const spots = (r.spots || []).filter(sp=>!chapter || chapter.cards.includes(sp.cardId));
    if (spots.length) try { localStorage.setItem(spotKey(key), JSON.stringify(spots)); } catch {}
    locating.delete(key); return spots;
  })());
  return locating.get(key);
}

// Static chapter art → generated fallback → ink sketch. Reports the displayed src.
function useBookImage(staticSrc, prompt) {
  const [src, setSrc] = useState(staticSrc || null);
  const [failed, setFailed] = useState(false);
  useEffect(()=>{ setSrc(staticSrc||null); setFailed(false); if (!staticSrc && prompt) flipImage(prompt).then(u=>u ? setSrc(u) : setFailed(true)); }, [staticSrc, prompt]);
  const onError = () => { if (src===staticSrc && prompt) { setSrc(null); flipImage(prompt).then(u=>u ? setSrc(u) : setFailed(true)); } else setFailed(true); };
  return {src, failed, onError};
}

// Hotspots: drop near-duplicates (< 0.08 apart) and put each label on a side where it hits no other dot / label.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function layoutSpots(spots=[], W=640) {
  const H = W*.75, kept = [];
  for (const sp of spots) if (!kept.some(k=>Math.hypot(k.x-sp.x, k.y-sp.y) < .08)) kept.push(sp);
  const dot = 22/W, placed = [];
  const rect = (sp, side) => { const w = (String(sp.label).length*13+20)/W, h = 24/H, dy = 22/H, dx = 22/W;
    return side==='below' ? [sp.x-w/2, sp.y+dy, w, h] : side==='above' ? [sp.x-w/2, sp.y-dy-h, w, h] : side==='right' ? [sp.x+dx, sp.y-h/2, w, h] : [sp.x-dx-w, sp.y-h/2, w, h]; };
  const hit = (r, q) => r[0] < q[0]+q[2] && q[0] < r[0]+r[2] && r[1] < q[1]+q[3] && q[1] < r[1]+r[3];
  return kept.map(sp=>{
    const dots = kept.filter(o=>o!==sp).map(o=>[o.x-dot, o.y-dot*1.33, dot*2, dot*2.66]);
    const side = ['below','above','right','left'].find(sd=>{ const r = rect(sp, sd); return r[0] >= 0 && r[0]+r[2] <= 1 && r[1] >= 0 && r[1]+r[3] <= 1 && !placed.some(q=>hit(r,q)) && !dots.some(q=>hit(r,q)); }) || 'below';
    placed.push(rect(sp, side)); return {...sp, side};
  });
}
function Hotspots({spots, active}) {
  return spots.map((h,i)=><div key={i} className={`fb-hot side-${h.side} ${active===i?'on':''}`} style={{left:`${h.x*100}%`, top:`${h.y*100}%`, animationDelay:`${i*.15}s`}}>
    <i/><span>{h.label}{getCard(h.cardId) && <em>💡 和「{getCard(h.cardId).title}」有关</em>}</span></div>);
}
const nearestSpot = (spots, x, y) => { const s = (spots||[]).map((sp,i)=>({i, d:Math.hypot(sp.x-x, sp.y-y)})).sort((a,b)=>a.d-b.d)[0]; return s && s.d < .07 ? s.i : -1; };

function Picture({imgKey, staticSrc, prompt, context, chapter, onTap, busy, tapMark}) {
  const {src, failed, onError} = useBookImage(staticSrc, prompt);
  const [spots, setSpots] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const box = useRef(null);
  useEffect(()=>{ setSpots(null); setLoaded(false); }, [imgKey]);
  useEffect(()=>{ if (!loaded || !src || !onTap) return; let live = true; locateSpots(imgKey, src, context, chapter).then(s=>live && setSpots(layoutSpots(s, box.current?.clientWidth || 640))); return ()=>{ live = false; }; }, [loaded, src, imgKey, !!onTap]);   // eslint-disable-line
  const click = e => { if (!onTap || busy || !src) return; const r = e.currentTarget.getBoundingClientRect(); onTap((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, src, spots||[]); };
  return (
    <div ref={box} className={`cb-pic ${onTap?'tappable':''}`} onClick={click}>
      {src && !failed ? <img src={src} alt="" draggable={false} onLoad={()=>setLoaded(true)} onError={onError}/>
        : failed ? <div className="fb-sketch"><span>{context.title}</span></div>
        : <div className="fb-shimmer"><span>博士正在画画…</span></div>}
      {onTap && loaded && spots && <Hotspots spots={spots} active={tapMark ? nearestSpot(spots, tapMark.x, tapMark.y) : -1}/>}
      {tapMark && <div className="fb-tap" style={{left:`${tapMark.x*100}%`, top:`${tapMark.y*100}%`}}/>}
      {busy && <div className="fb-wait"><div className="fb-doodle small"/><b>博士正在翻书…</b></div>}
    </div>
  );
}

// Branch level 2 (end page, no hotspots): the card's own pre-generated art if it exists, else the magnifier.
function CardArt({cardId, children}) {
  const [bad, setBad] = useState(false), [ok, setOk] = useState(false);
  useEffect(()=>{ setBad(false); setOk(false); }, [cardId]);
  if (bad || !cardId) return children;
  return (
    <div className="cb-pic cb-cardart">
      <img src={`/art/cards/${cardId}.jpg`} alt="" draggable={false} onLoad={()=>setOk(true)} onError={()=>setBad(true)} style={{opacity:ok?1:0}}/>
      {ok && <span className="cb-mag-tag">🔬 {getCard(cardId)?.title}</span>}
    </div>
  );
}

// Branch art = the main page's own picture, zoomed ~2.2× around the tap (same style, no generated text, instant).
const ZOOM = 2.2;
function Magnifier({src, x, y, spots=[], onTap, busy, tapMark}) {
  const h = .5/ZOOM;
  // Level 1: if a deeper hotspot is close, frame both the tap and that object so there is something to tap next.
  const near = spots.map(sp=>({sp, d:Math.max(Math.abs(sp.x-x), Math.abs(sp.y-y))})).filter(o=>o.d < h*1.6).sort((a,b)=>a.d-b.d)[0]?.sp;
  const cx = clamp(near ? (x+near.x)/2 : x, h, 1-h), cy = clamp(near ? (y+near.y)/2 : y, h, 1-h), L = cx-h, T = cy-h;
  const pos = v => `${(v/(1-1/ZOOM)*100).toFixed(2)}%`;
  const view = (px, py) => ({x:(px-L)*ZOOM, y:(py-T)*ZOOM});
  const vs = spots.map(sp=>({...sp, ...view(sp.x, sp.y)})).filter(sp=>sp.x > .04 && sp.x < .96 && sp.y > .05 && sp.y < .95);
  const box = useRef(null);
  const laid = useMemo(()=>layoutSpots(vs, box.current?.clientWidth || 640), [JSON.stringify(vs)]);   // eslint-disable-line
  const lens = view(x, y), tm = tapMark && view(tapMark.x, tapMark.y);
  const click = e => { if (!onTap || busy) return; const r = e.currentTarget.getBoundingClientRect(); onTap(L+(e.clientX-r.left)/r.width/ZOOM, T+(e.clientY-r.top)/r.height/ZOOM); };
  return (
    <div ref={box} className={`cb-pic cb-mag ${onTap?'tappable':''}`} onClick={click}>
      <div className="cb-mag-img" style={{backgroundImage:`url("${src}")`, backgroundSize:`${ZOOM*100}% ${ZOOM*100}%`, backgroundPosition:`${pos(L)} ${pos(T)}`}}/>
      <div className="cb-mag-lens" style={{left:`${lens.x*100}%`, top:`${lens.y*100}%`}}><i/></div>
      <div className="cb-mag-mini"><img src={src} alt=""/><b style={{left:`${L*100}%`, top:`${T*100}%`, width:`${100/ZOOM}%`, height:`${100/ZOOM}%`}}/></div>
      <span className="cb-mag-tag">🔍 放大 {ZOOM} 倍</span>
      {onTap && <Hotspots spots={laid} active={tm ? nearestSpot(laid, tm.x, tm.y) : -1}/>}
      {tm && <div className="fb-tap" style={{left:`${tm.x*100}%`, top:`${tm.y*100}%`}}/>}
      {busy && <div className="fb-wait"><div className="fb-doodle small"/><b>博士正在翻书…</b></div>}
    </div>
  );
}

/** 一章科学绘本：<ChapterBook chapter onClose onUnlock/>. 6-page arc + optional curiosity branches. */
export default function ChapterBook({chapter, onClose, onUnlock}) {
  const [n, setN] = useState(0);
  const [dir, setDir] = useState(1);
  const [guess, setGuess] = useState(null);
  const [quizAns, setQuizAns] = useState(null);
  const [expDone, setExpDone] = useState(false);
  const [voice, setVoice] = useState(()=>{ try { return localStorage.getItem('kos.bookvoice')!=='off'; } catch { return true; } });
  const [branch, setBranch] = useState(null);     // {src, spots, levels:[{page, x, y}]} — at most 2 levels deep
  const [busy, setBusy] = useState(false);
  const [tapMark, setTapMark] = useState(null);
  // Page ⑤ tests this chapter's own experiment (numbers from the lab's model), never a repeat for this kid.
  const quiz = useMemo(()=>labQuiz(chapter.id, getSeen()) || pickQuiz(chapter.quiz), [chapter.id]);
  const page = chapter.pages[n];
  useEffect(()=>{ if (page.kind==='quiz' && quiz) markSeen(quiz.id); }, [n]);   // eslint-disable-line
  const lvl = branch?.levels.at(-1), bp = lvl?.page || null, level = branch?.levels.length || 0;
  const used = branch ? branch.levels.map(l=>l.page.cardId).filter(Boolean) : [];
  const remaining = chapter.cards.filter(id=>!used.includes(id));
  const depth = bp?.offTopic ? 1 : chapter.cards.length > 1 ? 2 : 1;
  const canDeeper = level===1 && !bp?.offTopic && remaining.length > 0;
  const deeperSpots = canDeeper ? (branch.spots||[]).filter(sp=>remaining.includes(sp.cardId)) : [];
  const chInfo = {id:chapter.id, title:chapter.title, question:chapter.question, cards:chapter.cards};
  const Lab = EXPERIMENTS[chapter.experiment];
  useEffect(()=>()=>stopSpeaking(), []);
  // Narrate each page (doctor as narrator).
  useEffect(()=>{ if (!voice) return; const p = bp || page; const lines = bp ? [bp.title, ...bp.panels.map(x=>x.text)] : [page.title, ...page.text];
    speak(lines.join('。')); }, [n, bp?.id, voice]);   // eslint-disable-line
  // Warm the next page's art + hotspots.
  useEffect(()=>{ const nx = chapter.pages[n+1]; if (nx?.prompt) { const im = new Image(); im.src = bookArt(chapter.id, n+2); } }, [n, chapter.id]);
  useEffect(()=>{ const onKey = e => { if (e.key==='Escape') onClose?.(); if (branch) return; if (e.key==='ArrowRight' && canNext) go(n+1); if (e.key==='ArrowLeft') go(n-1); };
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey); });
  const canNext = n < chapter.pages.length-1 && !(page.kind==='hook' && guess==null) && !(page.kind==='quiz' && quizAns==null);
  const go = i => { if (i<0 || i>=chapter.pages.length) return; setDir(i>n?1:-1); setN(i); setBranch(null); stopSpeaking(); if (chapter.pages[i].kind==='wrap') { onUnlock?.(chapter.cards); try { const b = JSON.parse(localStorage.getItem('kos.badges')||'[]'); if (!b.includes(chapter.id)) localStorage.setItem('kos.badges', JSON.stringify([...b, chapter.id])); } catch {} } };
  const slim = spots => (spots||[]).map(({x, y, label, cardId})=>({x, y, label, cardId}));
  async function tapToBranch(x, y, src, spots) {   // main page → branch level 1
    if (busy) return;
    setBusy(true); setTapMark({x, y});
    const r = await flipTap({chapter:chInfo, page:{title:page.title, text:page.text}, imageDataUrl: await markTap(src, x, y).catch(()=>null), x, y, spots:slim(spots), exclude:[]});
    setBranch({src, spots:slim(spots), levels:[{page:r.page, x, y}]});
    if (r.page.cardId) onUnlock?.([r.page.cardId]);
    setBusy(false); setTapMark(null);
  }
  async function tapDeeper(x, y) {   // level 1 (zoomed main picture, coords in main-picture space) → level 2, a different card
    if (busy || !canDeeper) return;
    setBusy(true); setTapMark({x, y});
    const r = await flipTap({chapter:chInfo, page:{title:page.title, text:page.text}, imageDataUrl: await markTap(branch.src, x, y).catch(()=>null), x, y, spots:deeperSpots, exclude:used});
    setBranch(b=>({...b, levels:[...b.levels, {page:r.page, x, y}]}));
    if (r.page.cardId) onUnlock?.([r.page.cardId]);
    setBusy(false); setTapMark(null);
  }

  const texts = bp ? bp.panels.map(p=>p.text) : page.text;
  return (
    <div className="cb" style={{'--cc':chapter.color}}>
      <div className="cb-top">
        <button className="btn small" onClick={onClose}>✕ 合上</button>
        <div className="cb-q"><span className="kicker" style={{color:'var(--cc)'}}>科学绘本 · {chapter.title}</span><b>{chapter.question}</b></div>
        <div className="cb-dots">{chapter.pages.map((p,i)=><button key={i} className={`${i===n?'on':''} ${i<n?'done':''}`} title={KIND_LABEL[p.kind]} onClick={()=>i<=n && go(i)}>{NUM[i]}</button>)}</div>
        {ttsSupported && <button className="btn small" onClick={()=>setVoice(v=>{ const nv=!v; try { localStorage.setItem('kos.bookvoice', nv?'on':'off'); } catch {} if (!nv) stopSpeaking(); return nv; })}>{voice?'🔊 朗读':'🔇 朗读'}</button>}
      </div>

      <div className="cb-stage">
        <div key={bp ? bp.id : n} className={`cb-page ${dir>0?'curl-f':'curl-b'}`}>
          <div className="cb-left">
            {bp ? (level===2 && bp.cardId ? <CardArt cardId={bp.cardId}><Magnifier key={level} src={branch.src} x={lvl.x} y={lvl.y}/></CardArt>
              : <Magnifier key={level} src={branch.src} x={lvl.x} y={lvl.y} spots={deeperSpots} onTap={canDeeper ? tapDeeper : undefined} busy={busy} tapMark={tapMark}/>)
            : page.kind==='experiment' && Lab ? <div className="cb-panel cb-lab"><Lab onDone={()=>setExpDone(true)}/></div>
            : page.kind==='quiz' ? <div className="cb-panel cb-quiz">
                <div className="cb-quiz-q">🤔 {quiz.q}</div>
                <div className="cb-quiz-opts">{quiz.options.map((o,i)=><button key={i} disabled={quizAns!=null} className={`rp-quiz-opt ${quizAns!=null&&i===quiz.answer?'right':''} ${quizAns===i&&i!==quiz.answer?'wrong':''}`} onClick={()=>setQuizAns(i)}><b>{'ABC'[i]}</b>{o}</button>)}</div>
                {quizAns!=null && <div className="cb-quiz-reveal slidein">{quizAns===quiz.answer?'✅ 答对了！':'❌ 差一点！'} {quiz.explain}</div>}
              </div>
            : page.kind==='wrap' ? <div className="cb-wrapart"><Picture imgKey={`${chapter.id}/${n+1}`} staticSrc={bookArt(chapter.id, n+1)} prompt={page.prompt} context={{title:page.title, text:page.text.join(' ')}}/>
                <div className="cb-badge pop-in"><span>🏅</span><b>{chapter.badge}</b><small>徽章到手！</small></div></div>
            : <Picture imgKey={`${chapter.id}/${n+1}`} staticSrc={bookArt(chapter.id, n+1)} prompt={page.prompt} context={{title:page.title, text:page.text.join(' ')}} chapter={chapter}
                onTap={page.kind==='observe'||page.kind==='analogy' ? tapToBranch : undefined} busy={busy} tapMark={tapMark}/>}
          </div>
          <div className="cb-right">
            <div className="cb-kind">{bp ? (bp.offTopic ? '🔍 好奇心支线' : <>🔍 好奇心<b className="cb-depth">支线 {level}/{depth}</b></>) : `${NUM[n]} ${KIND_LABEL[page.kind]}`}</div>
            <h2 className="cb-title">{bp ? bp.title : page.title}</h2>
            <div className={`cb-texts ${bp?'branch':''}`}>{texts.map((t,i)=><div key={i} className={`cb-text ${i===0?'caption':'bubble'}`} style={{animationDelay:`${.1+i*.2}s`}}>{t}</div>)}</div>
            {!bp && page.kind==='hook' && <div className="cb-guess">{page.guess.map((g,i)=><button key={i} className={`btn ${guess===i?'ink':''}`} onClick={()=>setGuess(i)}>{g}</button>)}
              {guess!=null && <div className="cb-guess-note slidein">记住你的猜测，看完这本书再对答案！</div>}
              {guess!=null && <button className="btn primary big cb-next-inline pop-in" onClick={()=>go(n+1)}>翻到下一页：{KIND_LABEL[chapter.pages[n+1].kind]} ▶</button>}</div>}
            {!bp && page.kind==='wrap' && guess!=null && <div className={`cb-check ${guess===page.answer||guess===chapter.pages[0].answer?'ok':'no'}`}>{guess===chapter.pages[0].answer ? '✅ 你一开始就猜对了！' : `开头你猜的是「${chapter.pages[0].guess[guess]}」，现在你知道为什么不是啦！`}</div>}
            {!bp && (page.kind==='observe'||page.kind==='analogy') && <div className="cb-hint">👆 点画里你好奇的东西，打开「好奇心支线」</div>}
            {!bp && page.kind==='experiment' && <div className="cb-hint">{expDone ? '✅ 实验做完了！发现了什么？' : '🧪 做完实验再往下翻'}</div>}
            {!bp && canNext && page.kind!=='hook' && <button className="btn primary cb-next-inline" onClick={()=>go(n+1)}>下一页：{KIND_LABEL[chapter.pages[n+1].kind]} ▶</button>}
            {bp && (bp.cardId && getCard(bp.cardId)) && <div className="cb-cardref">🔬 本章知识卡：{getCard(bp.cardId).title}</div>}
            {bp && canDeeper && <div className="cb-hint">👆 在放大的画里再点一个，还能再挖一层（最后一层）</div>}
            {bp && <div className="cb-branch-nav">
              <button className="btn primary big" onClick={()=>{ stopSpeaking(); setBranch(null); }}>↩ 回到主线</button>
              {!bp.offTopic && n < chapter.pages.length-1 && <button className="btn big" onClick={()=>go(n+1)}>📖 这一章还讲了什么</button>}
            </div>}
            {!bp && page.kind==='wrap' && <div className="cb-end"><button className="btn" onClick={()=>{ setGuess(null); setQuizAns(null); setExpDone(false); go(0); }}>📖 再读一遍</button><button className="btn primary" onClick={onClose}>回游戏 ▶</button></div>}
          </div>
        </div>
      </div>

      <div className="cb-nav">
        <button className="rp-arrow" disabled={n===0 || !!bp} onClick={()=>go(n-1)}>◀</button>
        <div className="cb-progress"><i style={{width:`${(n+1)/chapter.pages.length*100}%`}}/></div>
        <button className="rp-arrow next" disabled={!canNext || !!bp} onClick={()=>go(n+1)}>{n<chapter.pages.length-1 ? `${KIND_LABEL[chapter.pages[n+1].kind]} ▶` : '完'}</button>
      </div>
    </div>
  );
}
