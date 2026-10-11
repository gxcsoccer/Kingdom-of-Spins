import {useEffect, useMemo, useRef, useState} from 'react';
import {bookArt} from './chapters.js';
import {EXPERIMENTS} from './experiments.jsx';
import {flipImage, flipTap, markTap} from './api.js';
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
const spotKey = key => 'kos.spots.' + key.slice(0, 120);
const locating = new Map();
export function locateSpots(key, src, context) {
  try { const hit = localStorage.getItem(spotKey(key)); if (hit) return Promise.resolve(JSON.parse(hit)); } catch {}
  if (!locating.has(key)) locating.set(key, (async()=>{
    const imageDataUrl = await toDataUrl(src);
    const r = await fetch('/api/ai/flip/locate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({imageDataUrl, context})}).then(x=>x.json()).catch(()=>({spots:[]}));
    const spots = r.spots || [];
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

function Picture({imgKey, staticSrc, prompt, context, onTap, busy, tapMark}) {
  const {src, failed, onError} = useBookImage(staticSrc, prompt);
  const [spots, setSpots] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(()=>{ setSpots(null); setLoaded(false); }, [imgKey]);
  useEffect(()=>{ if (!loaded || !src) return; let live = true; locateSpots(imgKey, src, context).then(s=>live && setSpots(s)); return ()=>{ live = false; }; }, [loaded, src, imgKey]);   // eslint-disable-line
  const click = e => { if (!onTap || busy || !src) return; const r = e.currentTarget.getBoundingClientRect(); onTap((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, src, spots); };
  return (
    <div className={`cb-pic ${onTap?'tappable':''}`} onClick={click}>
      {src && !failed ? <img src={src} alt="" draggable={false} onLoad={()=>setLoaded(true)} onError={onError}/>
        : failed ? <div className="fb-sketch"><span>{context.title}</span></div>
        : <div className="fb-shimmer"><span>博士正在画画…</span></div>}
      {onTap && loaded && spots?.map((h,i)=><div key={i} className="fb-hot" style={{left:`${h.x*100}%`, top:`${h.y*100}%`, animationDelay:`${i*.15}s`}}><i/><span>{h.label}</span></div>)}
      {tapMark && <div className="fb-tap" style={{left:`${tapMark.x*100}%`, top:`${tapMark.y*100}%`}}/>}
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
  const [branch, setBranch] = useState(null);     // {pages:[page...], i}
  const [busy, setBusy] = useState(false);
  const [tapMark, setTapMark] = useState(null);
  // Page ⑤ tests this chapter's own experiment (numbers from the lab's model), never a repeat for this kid.
  const quiz = useMemo(()=>labQuiz(chapter.id, getSeen()) || pickQuiz(chapter.quiz), [chapter.id]);
  const page = chapter.pages[n];
  useEffect(()=>{ if (page.kind==='quiz' && quiz) markSeen(quiz.id); }, [n]);   // eslint-disable-line
  const bp = branch ? branch.pages[branch.i] : null;
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
  async function tapToBranch(x, y, src, spots) {
    if (busy) return;
    setBusy(true); setTapMark({x, y});
    const base = bp || {title: page.title, panels: page.text.map(t=>({text:t})), hotspots: spots||[], cardId: chapter.cards[0], imagePrompt: page.prompt};
    const trail = [chapter.question, page.title, ...(branch?.pages.map(p=>p.title)||[])];
    const r = await flipTap({page: base, imageDataUrl: await markTap(src, x, y).catch(()=>null), x, y, trail});
    setBranch(b=>({pages:[...(b?.pages.slice(0, b.i+1)||[]), r.page], i:(b ? b.i+1 : 0)}));
    onUnlock?.([r.page.cardId]);
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
            {bp ? <Picture imgKey={bp.id} prompt={bp.imagePrompt} context={{title:bp.title, text:texts.join(' ')}} onTap={tapToBranch} busy={busy} tapMark={tapMark}/>
            : page.kind==='experiment' && Lab ? <div className="cb-panel cb-lab"><Lab onDone={()=>setExpDone(true)}/></div>
            : page.kind==='quiz' ? <div className="cb-panel cb-quiz">
                <div className="cb-quiz-q">🤔 {quiz.q}</div>
                <div className="cb-quiz-opts">{quiz.options.map((o,i)=><button key={i} disabled={quizAns!=null} className={`rp-quiz-opt ${quizAns!=null&&i===quiz.answer?'right':''} ${quizAns===i&&i!==quiz.answer?'wrong':''}`} onClick={()=>setQuizAns(i)}><b>{'ABC'[i]}</b>{o}</button>)}</div>
                {quizAns!=null && <div className="cb-quiz-reveal slidein">{quizAns===quiz.answer?'✅ 答对了！':'❌ 差一点！'} {quiz.explain}</div>}
              </div>
            : page.kind==='wrap' ? <div className="cb-wrapart"><Picture imgKey={`${chapter.id}/${n+1}`} staticSrc={bookArt(chapter.id, n+1)} prompt={page.prompt} context={{title:page.title, text:page.text.join(' ')}}/>
                <div className="cb-badge pop-in"><span>🏅</span><b>{chapter.badge}</b><small>徽章到手！</small></div></div>
            : <Picture imgKey={`${chapter.id}/${n+1}`} staticSrc={bookArt(chapter.id, n+1)} prompt={page.prompt} context={{title:page.title, text:page.text.join(' ')}}
                onTap={page.kind==='observe'||page.kind==='analogy' ? tapToBranch : undefined} busy={busy} tapMark={tapMark}/>}
          </div>
          <div className="cb-right">
            <div className="cb-kind">{bp ? '🔍 好奇心支线' : `${NUM[n]} ${KIND_LABEL[page.kind]}`}</div>
            <h2 className="cb-title">{bp ? bp.title : page.title}</h2>
            <div className="cb-texts">{texts.map((t,i)=><div key={i} className={`cb-text ${i===0?'caption':'bubble'}`} style={{animationDelay:`${.1+i*.2}s`}}>{t}</div>)}</div>
            {!bp && page.kind==='hook' && <div className="cb-guess">{page.guess.map((g,i)=><button key={i} className={`btn ${guess===i?'ink':''}`} onClick={()=>setGuess(i)}>{g}</button>)}
              {guess!=null && <div className="cb-guess-note slidein">记住你的猜测，看完这本书再对答案！</div>}
              {guess!=null && <button className="btn primary big cb-next-inline pop-in" onClick={()=>go(n+1)}>翻到下一页：{KIND_LABEL[chapter.pages[n+1].kind]} ▶</button>}</div>}
            {!bp && page.kind==='wrap' && guess!=null && <div className={`cb-check ${guess===page.answer||guess===chapter.pages[0].answer?'ok':'no'}`}>{guess===chapter.pages[0].answer ? '✅ 你一开始就猜对了！' : `开头你猜的是「${chapter.pages[0].guess[guess]}」，现在你知道为什么不是啦！`}</div>}
            {!bp && (page.kind==='observe'||page.kind==='analogy') && <div className="cb-hint">👆 点画里你好奇的东西，打开「好奇心支线」</div>}
            {!bp && page.kind==='experiment' && <div className="cb-hint">{expDone ? '✅ 实验做完了！发现了什么？' : '🧪 做完实验再往下翻'}</div>}
            {!bp && canNext && page.kind!=='hook' && <button className="btn primary cb-next-inline" onClick={()=>go(n+1)}>下一页：{KIND_LABEL[chapter.pages[n+1].kind]} ▶</button>}
            {bp && <div className="cb-branch-nav">
              <button className="btn" onClick={()=>setBranch(null)}>↩ 回到主线</button>
              {branch.i>0 && <button className="btn small" onClick={()=>setBranch(b=>({...b, i:b.i-1}))}>◀ 支线上一页</button>}
              <span className="cb-hint">继续点画面，挖得更深！</span>
            </div>}
            {!bp && page.kind==='wrap' && <div className="cb-end"><button className="btn" onClick={()=>{ setGuess(null); setQuizAns(null); setExpDone(false); go(0); }}>📖 再读一遍</button><button className="btn primary" onClick={onClose}>回游戏 ▶</button></div>}
            {(bp ? getCard(bp.cardId) : null) && <div className="cb-cardref">🔬 相关知识卡：{getCard(bp.cardId).title}</div>}
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
