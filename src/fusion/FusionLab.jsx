import {useEffect, useRef, useState} from 'react';
import {fusionChat, ask, sketch as sketchApi, fileToDataUrl} from '../ai/client.js';
import {speak, stopSpeaking, ttsSupported, useMic} from './voice.js';
import {fusionName, keptParts} from '../ai/fallback.js';
import {getCard} from '../knowledge/cards.js';
import KnowledgeCard, {KnowledgeChip} from '../knowledge/KnowledgeCard.jsx';
import {StatBars, TypeBadge} from '../ui/common.jsx';
import BeyArt, {BeySvg} from '../ui/BeyArt.jsx';
import {TIPS} from '../physics/model.js';
import {beyStats} from '../game/stats.js';
import './fusion.css';

const WISHES = ['转得超级久 🌀', '把对手撞飞 💥', '稳如泰山，撞不动 🛡️', '又快又猛 ⚡'];
const PREDICTIONS = ['能把对手撞飞！', '会比对手转得更久', '可能会被撞出去…', '不知道，做实验看看！'];
const isQuestion = t => /[？?]$|为什么|什么是|怎么|是什么|会不会/.test(t.trim());
const PARAM_ROWS = [
  ['wings','翼片', v=>`${v} 片`],
  ['reach','刃半径', v=>`${(v*1000).toFixed(1)} mm`],
  ['ring','外圈配重', v=>`${Math.round(v)}%`],
  ['mass','刃重', v=>`${(+v).toFixed(1)} g`],
];

function Doctor({mood='talk'}) {
  return (
    <div className={`doctor ${mood}`} aria-hidden>
      <div className="doctor-face"><span className="doctor-eye"/><span className="doctor-eye"/><span className="doctor-mouth"/></div>
      <div className="doctor-hair"/>
      <div className="doctor-name">融合博士</div>
    </div>
  );
}

function FusingAnim({a, b}) {
  return (
    <div className="fusing">
      <div className="fusing-l"><BeySvg bey={a} size={110} spin/></div>
      <div className="fusing-flash"><span className="sfx" style={{fontSize:44}}>合体！</span></div>
      <div className="fusing-r"><BeySvg bey={b} size={110} spin/></div>
      <div className="fusing-text">融合博士正在计算物理参数…</div>
    </div>
  );
}

function CandidateCard({bey, parents, onPick, renderBey}) {
  const st = beyStats(bey);
  return (
    <div className="panel cand slidein" style={{background:`radial-gradient(circle at 50% 30%, ${bey.colors.accent}40, transparent 60%), var(--tone-light), #fff`}}>
      {bey.fusedBy==='template' && <span className="badge cand-tag">公式方案</span>}
      <div className="cand-art">{renderBey ? renderBey(bey, 170) : <BeyArt bey={bey} size={170}/>}</div>
      <div className="row between" style={{alignItems:'flex-start',gap:8}}>
        <div>
          <div className="panel-title" style={{fontSize:24}}>{bey.name}</div>
          <div className="muted" style={{fontWeight:800}}>{bey.zh}</div>
        </div>
        <TypeBadge type={bey.type}/>
      </div>
      <div className="mt"><StatBars bey={bey}/></div>
      <table className="cand-diff mt">
        <thead><tr><th>Blade</th>{parents.map(p=><th key={p.id}>{p.name}</th>)}<th className="new">{parents.length?'新':'数值'}</th></tr></thead>
        <tbody>{PARAM_ROWS.map(([k,label,fmt])=>(
          <tr key={k}><td>{label}</td>{parents.map(p=><td key={p.id}>{fmt(p.blade[k])}</td>)}<td className="new">{fmt(bey.blade[k])}</td></tr>
        ))}
          <tr><td>转动惯量</td>{parents.map(p=><td key={p.id}>{beyStats(p).inertia}</td>)}<td className="new">{st.inertia}</td></tr>
        </tbody>
      </table>
      <div className="model-note">转动惯量单位 ×10⁻⁶ kg·m²，由理想模型从参数算出</div>
      {bey.specialMove && <div className="special-move"><span className="kicker">必杀技</span><b>{bey.specialMove.name}</b><span className="sfx" style={{fontSize:18}}>「{bey.specialMove.shout}」</span></div>}
      {bey.why && <p className="cand-why"><b>为什么：</b>{bey.why}</p>}
      {bey.tradeoff && <p className="cand-trade"><b>代价：</b>{bey.tradeoff}</p>}
      {bey.prediction && <p className="cand-trade"><b>博士预测：</b>{bey.prediction}</p>}
      <div className="col" style={{gap:6}}>{bey.knowledge?.map(k=><KnowledgeChip key={k.id} card={k}/>)}</div>
      <button className="btn primary mt" style={{width:'100%'}} onClick={()=>onPick(bey)}>就选它！</button>
    </div>
  );
}

/**
 * 融合工坊.
 * props: collection [Bey], onSave(newBey) — newBey includes kidPrediction & knowledge;
 *        onClose(); renderBey?(bey, size) to override the 2D art (e.g. 3D showcase);
 *        onUnlock?(cardIds) when knowledge cards are revealed; opponents? [Bey] for the prediction step.
 */
export default function FusionLab({collection=[], onSave, onClose, renderBey, onUnlock, opponents}) {
  const [step, setStep] = useState('pick');
  const [picked, setPicked] = useState([]);
  const [keep, setKeep] = useState(0);
  const [log, setLog] = useState([]);            // {role:'user'|'assistant', content, question?, options?, cards?}
  const [candidates, setCandidates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [chosen, setChosen] = useState(null);
  const [prediction, setPrediction] = useState('');
  const [voiceOn, setVoiceOn] = useState(()=>{ try { return localStorage.getItem('kos.voice')!=='off'; } catch { return true; } });
  const [sk, setSk] = useState({img:null, wish:'', keep:0, busy:false, result:null, msg:''});   // 📷 sketch flow
  const fileRef = useRef(null);
  const mic = useMic({onInterim:t=>setInput(t), onFinal:t=>send(t)});
  const logEnd = useRef(null);
  const parents = picked.map(id=>collection.find(b=>b.id===id)).filter(Boolean);
  const kept = parents.length===2 ? keptParts(parents, keep) : null;
  const name = parents.length===2 ? fusionName(parents[0], parents[1]) : '';
  const rival = opponents?.[0] || parents[1] || null;

  useEffect(()=>{ logEnd.current?.scrollIntoView({behavior:'smooth', block:'nearest'}); }, [log, busy, candidates]);
  // 融合博士 reads each new reply aloud (toggle 🔊/🔇).
  useEffect(()=>{
    const last = log.at(-1);
    if (voiceOn && last?.role==='assistant') speak([last.content, last.question].filter(Boolean).join('。'));
  }, [log, voiceOn]);
  useEffect(()=>()=>stopSpeaking(), []);
  function toggleVoice() {
    setVoiceOn(v=>{ const n=!v; try { localStorage.setItem('kos.voice', n?'on':'off'); } catch {} if (!n) stopSpeaking(); return n; });
  }
  async function onPickImage(e) {
    const f = e.target.files?.[0]; e.target.value=''; if (!f) return;
    try { const img = await fileToDataUrl(f, 1024); setSk(s=>({...s, img, result:null, msg:''})); }
    catch { setSk(s=>({...s, msg:'这张图片打不开，换一张试试？'})); }
  }
  async function runSketch() {
    if (!sk.img || sk.busy) return;
    setSk(s=>({...s, busy:true, msg:'', result:null}));
    const base = collection[sk.keep];
    const r = await sketchApi({imageDataUrl:sk.img, wish:sk.wish, keepParts: base ? {ratchet:base.ratchet, bit:base.bit} : null});
    if (r.bey) { setSk(s=>({...s, busy:false, result:r.bey})); if (voiceOn) speak(`${r.bey.why||''} 必杀技，${r.bey.specialMove?.name||''}！`); onUnlock?.(r.bey.knowledge.map(k=>k.id)); }
    else setSk(s=>({...s, busy:false, msg: r.needKey ? '这个功能要用高级 AI 看画，需要家长先开启哦（在家长设置里）。现在可以先用“选两只陀螺融合”！' : '博士没看清这张画，再拍清楚一点试试？'}));
  }

  const togglePick = id => setPicked(p => p.includes(id) ? p.filter(x=>x!==id) : p.length<2 ? [...p, id] : [p[1], id]);

  async function send(text) {
    const t = String(text||'').trim(); if (!t || busy) return;
    setInput('');
    const history = log.map(({role, content, question})=>({role, content, question}));
    setLog(l=>[...l, {role:'user', content:t}]);
    setBusy(true);
    try {
      if (isQuestion(t) && candidates.length) {
        const r = await ask(t, `正在融合 ${parents.map(p=>p.name).join(' + ')}`);
        setLog(l=>[...l, {role:'assistant', content:r.answer, cards:r.cards}]);
        onUnlock?.(r.cards.map(c=>c.id));
        return;
      }
      const wish = [...log.filter(m=>m.role==='user').map(m=>m.content), t].join('；');
      const r = await fusionChat({parents, wish, history, keepParent:keep});
      if (r.question) setLog(l=>[...l, {role:'assistant', content:r.reply, question:r.question, options:r.options}]);
      else {
        setLog(l=>[...l, {role:'assistant', content:r.reply + (r.fallback ? '（博士的 AI 线路忙，先用物理公式算的方案）' : '')}]);
        setCandidates(r.candidates||[]);
        onUnlock?.([...new Set((r.candidates||[]).flatMap(c=>c.knowledge.map(k=>k.id)))]);
      }
    } finally { setBusy(false); }
  }

  function startChat() {
    setStep('chat');
    setLog([{role:'assistant', content:`${parents[0].name} + ${parents[1].name}……合体名字就叫 ${name}！告诉我，你想要一只什么样的陀螺？`}]);
    onUnlock?.(['gd-fusion-blade-only','bx-three-parts']);
  }
  function save() {
    const bey = {...chosen, kidPrediction: prediction ? {text:prediction, vs: rival?.id||null, at: Date.now()} : null, createdAt: Date.now()};
    setStep('done');
    setTimeout(()=>onSave?.(bey), 1400);
  }

  return (
    <div className="fusion page">
      <div className="topbar">
        <div className="row">
          {onClose && <button className="btn small" onClick={onClose}>◀ 返回</button>}
          <div>
            <div className="kicker">FUSION LAB</div>
            <h1 className="h-display h-outline" style={{fontSize:'clamp(30px,4.4vw,52px)'}}>融合工坊</h1>
          </div>
        </div>
        <div className="steps">{['pick','keep','chat','predict'].map((s,i)=>(
          <span key={s} className={`step ${s===step||(step==='done'&&s==='predict')?'on':''}`}>{i+1} {['选陀螺','选底座','聊设计','做预测'][i]}</span>
        ))}</div>
      </div>

      {step==='pick' && (
        <section className="slidein">
          <div className="row" style={{alignItems:'flex-end',gap:14}}>
            <Doctor/>
            <div className="bubble grow">选两只陀螺放进融合炉！它们的 <b>Blade</b> 会合体变成一片全新的刃。{collection.length<2 && <b style={{color:'var(--red)'}}> 你至少需要 2 只陀螺才能融合哦。</b>}</div>
          </div>
          <div className="pick-grid mt2">
            {collection.map(b=>{
              const idx = picked.indexOf(b.id);
              return (
                <button key={b.id} className={`panel pick ${idx>=0?'on':''}`} onClick={()=>togglePick(b.id)}>
                  {idx>=0 && <span className="pick-n">{idx===0?'A':'B'}</span>}
                  {renderBey ? renderBey(b, 120) : <BeyArt bey={b} size={120}/>}
                  <div className="panel-title" style={{fontSize:18}}>{b.name}</div>
                  <TypeBadge type={b.type||b.blade?.style}/>
                </button>
              );
            })}
          </div>
          <div className="row center mt2 wrap" style={{gap:14}}>
            <button className="btn yellow big" onClick={()=>setStep('sketch')}>📷 画一个陀螺</button>
            <button className="btn primary big" disabled={parents.length<2} onClick={()=>setStep('keep')}>
              {parents.length===2 ? `${parents[0].name} × ${parents[1].name} ▶` : `再选 ${2-parents.length} 只`}
            </button>
          </div>
        </section>
      )}

      {step==='sketch' && (
        <section className="slidein">
          <div className="row" style={{alignItems:'flex-end',gap:14}}>
            <Doctor mood={sk.busy?'think':'talk'}/>
            <div className="bubble grow">把你画的梦想陀螺拍给我看！我会数一数它有几片刃、哪里最重、是什么颜色，把它变成真的能上场的 <b>Blade</b>。</div>
          </div>
          <div className="sketch-grid mt2">
            <div className="panel sketch-drop" onClick={()=>fileRef.current?.click()}>
              {sk.img ? <img src={sk.img} alt="你的画"/> : <div className="sketch-empty"><span style={{fontSize:56}}>📷</span><b>拍照 / 选一张画</b><span className="muted">画在纸上就行，越清楚越好</span></div>}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickImage}/>
            </div>
            <div className="col">
              <label className="kicker">想对博士说点什么？（可以不填）</label>
              <input className="sketch-wish" value={sk.wish} onChange={e=>setSk(s=>({...s, wish:e.target.value}))} placeholder="比如：它是一条会喷火的龙！" maxLength={60}/>
              {collection.length>0 && <>
                <label className="kicker mt">用谁的 Ratchet 和 Bit？</label>
                <div className="row wrap" style={{gap:8}}>{collection.slice(0,8).map((b,i)=>(
                  <button key={b.id} className={`btn small ${sk.keep===i?'ink':''}`} onClick={()=>setSk(s=>({...s, keep:i}))}>{b.name} · {b.ratchet?.prongs}-{b.ratchet?.height} · {TIPS[b.bit]?.label?.split(' ')[0]}</button>
                ))}</div>
              </>}
              <div className="row mt" style={{gap:10}}>
                <button className="btn" onClick={()=>setStep('pick')}>◀ 返回</button>
                <button className="btn primary big" disabled={!sk.img||sk.busy} onClick={runSketch}>{sk.busy?'博士在看画…':'让博士看看！⚡'}</button>
              </div>
              {sk.msg && <div className="bubble mt">{sk.msg}</div>}
            </div>
          </div>
          {sk.result && (
            <div className="cand-zone mt2">
              <h2 className="h-display h-yellow" style={{fontSize:30}}>你的画变成了……</h2>
              <div className="cand-grid mt" style={{maxWidth:420}}><CandidateCard bey={sk.result} parents={[]} renderBey={renderBey} onPick={b=>{setChosen(b);setStep('predict');}}/></div>
            </div>
          )}
        </section>
      )}

      {step==='keep' && parents.length===2 && (
        <section className="slidein">
          <div className="row" style={{alignItems:'flex-end',gap:14}}>
            <Doctor/>
            <div className="bubble grow">注意！融合只换 <b>Blade</b>。下面的 <b>Ratchet</b>（棘轮）和 <b>Bit</b>（轴尖）要从一只陀螺身上继承。你想保留谁的？</div>
          </div>
          <div className="keep-grid mt2">
            {parents.map((p,i)=>(
              <button key={p.id} className={`panel keep ${keep===i?'on':''}`} onClick={()=>setKeep(i)}>
                {renderBey ? renderBey(p, 130) : <BeyArt bey={p} size={130}/>}
                <div className="panel-title" style={{fontSize:20}}>{p.name}</div>
                <div className="keep-parts">
                  <span className="chip">⚙ Ratchet {p.ratchet?.prongs}-{p.ratchet?.height}</span>
                  <span className="chip">🔻 Bit {TIPS[p.bit]?.label}</span>
                </div>
                <div className="muted" style={{fontSize:13,fontWeight:700}}>{TIPS[p.bit]?.desc}</div>
                {keep===i && <span className="sfx keep-sfx">保留！</span>}
              </button>
            ))}
          </div>
          <div className="row wrap mt" style={{gap:12}}>
            <KnowledgeChip card="gd-fusion-blade-only"/><KnowledgeChip card="bx-ratchet-numbers"/><KnowledgeChip card="bx-bit-role"/>
          </div>
          <div className="row center mt2" style={{gap:12}}>
            <button className="btn" onClick={()=>setStep('pick')}>◀ 重选</button>
            <button className="btn primary big" onClick={startChat}>开始融合 ⚡</button>
          </div>
        </section>
      )}

      {step==='chat' && (
        <section className="chat-layout slidein">
          <div className="panel chat-panel">
            <div className="chat-head">
              <Doctor mood={busy?'think':'talk'}/>
              <div>
                <div className="panel-title" style={{fontSize:22}}>{name}</div>
                <div className="muted" style={{fontSize:13,fontWeight:700}}>保留 {parents[keep].name} 的 Ratchet {kept.ratchet.prongs}-{kept.ratchet.height} · Bit {TIPS[kept.bit]?.label}</div>
              </div>
            </div>
            <div className="chat-log">
              {log.map((m,i)=>(
                <div key={i} className={`msg ${m.role}`}>
                  <div className={`bubble ${m.role==='user'?'right':''}`}>
                    {m.content}
                    {m.question && <div className="msg-q">{m.question}</div>}
                    {m.cards?.length>0 && <div className="col" style={{gap:6,marginTop:8}}>{m.cards.map(c=><KnowledgeChip key={c.id} card={c}/>)}</div>}
                  </div>
                  {m.options && i===log.length-1 && !busy && (
                    <div className="row wrap opts">{m.options.map(o=><button key={o} className="btn small yellow" onClick={()=>send(o)}>{o}</button>)}</div>
                  )}
                </div>
              ))}
              {busy && <FusingAnim a={parents[0]} b={parents[1]}/>}
              <div ref={logEnd}/>
            </div>
            {log.length<=1 && !busy && <div className="row wrap opts" style={{padding:'0 14px'}}>{WISHES.map(w=><button key={w} className="btn small yellow" onClick={()=>send(w)}>{w}</button>)}</div>}
            <form className="chat-input" onSubmit={e=>{e.preventDefault();send(input);}}>
              {ttsSupported && <button type="button" className="btn small" title={voiceOn?'博士说话：开':'博士说话：关'} onClick={toggleVoice}>{voiceOn?'🔊':'🔇'}</button>}
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder={mic.listening?'我在听…松开就发送':candidates.length?'还想改？或者问博士一个问题…':'说说你想要的陀螺…'} maxLength={120} disabled={busy}/>
              {mic.supported && <button type="button" className={`btn mic ${mic.listening?'on':''}`} disabled={busy} title="按住说话"
                onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);mic.start();}} onPointerUp={mic.stop} onPointerCancel={mic.stop} onContextMenu={e=>e.preventDefault()}>🎤</button>}
              <button className="btn primary" disabled={busy||!input.trim()}>发送</button>
            </form>
          </div>
          {candidates.length>0 && (
            <div className="cand-zone">
              <div className="row between wrap">
                <h2 className="h-display h-yellow" style={{fontSize:30}}>融合方案</h2>
                <span className="model-note">数值来自理想化物理模型，对战结果只代表这个模型</span>
              </div>
              <div className="cand-grid mt">{candidates.map(c=><CandidateCard key={c.id} bey={c} parents={parents} renderBey={renderBey} onPick={b=>{setChosen(b);setStep('predict');}}/>)}</div>
            </div>
          )}
        </section>
      )}

      {step==='predict' && chosen && (
        <section className="slidein predict">
          <div className="panel predict-hero">
            <div className="burst"/>
            {renderBey ? renderBey(chosen, 220) : <BeyArt bey={chosen} size={220} spin/>}
            <div>
              <div className="kicker">NEW BLADE</div>
              <div className="h-display h-red" style={{fontSize:'clamp(36px,6vw,64px)'}}>{chosen.name}</div>
              <div className="row" style={{gap:8,marginTop:8}}><TypeBadge type={chosen.type}/><span className="chip">⚙ {chosen.ratchet?.prongs}-{chosen.ratchet?.height}</span><span className="chip">🔻 {TIPS[chosen.bit]?.label}</span></div>
            </div>
          </div>
          <div className="row mt2" style={{alignItems:'flex-end',gap:14}}>
            <Doctor/>
            <div className="bubble grow">科学家都会先预测！你觉得 <b>{chosen.name}</b> 对战 <b>{rival?.name||'对手'}</b> 会怎样？猜错也没关系，打完我们一起对答案。</div>
          </div>
          <div className="row wrap center mt" style={{gap:10}}>
            {PREDICTIONS.map(p=><button key={p} className={`btn ${prediction===p?'ink':''}`} onClick={()=>setPrediction(p)}>{p}</button>)}
          </div>
          <div className="row center mt"><KnowledgeCard card={getCard('sm-predict')} compact/></div>
          <div className="row center mt2" style={{gap:12}}>
            <button className="btn" onClick={()=>setStep('chat')}>◀ 换一个</button>
            <button className="btn primary big" disabled={!prediction} onClick={save}>保存新陀螺 ✦</button>
          </div>
        </section>
      )}

      {step==='done' && chosen && (
        <section className="done">
          <div className="burst"/>
          <span className="sfx pop" style={{fontSize:'clamp(56px,10vw,120px)'}}>融合成功！</span>
          {renderBey ? renderBey(chosen, 240) : <BeyArt bey={chosen} size={240} spin/>}
          <div className="h-display h-outline" style={{fontSize:40}}>{chosen.name}</div>
        </section>
      )}
    </div>
  );
}
