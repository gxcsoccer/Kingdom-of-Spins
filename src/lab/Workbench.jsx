import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BeyShowcase from '../scene/BeyShowcase.jsx';
import { TIPS, specFromBey, makePart, wingOutline } from '../physics/model.js';
import { isMuted } from '../game/sfx.js';

// Hands-on experiment bench: drag weight blocks, drop a bit into the tip slot, pull the ratchet
// lever, flip wing count. Only ONE variable may differ from the base bey (single-variable rule).

// ---------- sound: short "咔嚓" (two filtered clicks)
let actx;
function kacha(pitch = 1) {
  if (isMuted?.()) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime;
    [[0, 3200], [.07, 1800]].forEach(([dt, f]) => {
      const len = .035, buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = 3; g.gain.value = .7;
      src.connect(bp).connect(g).connect(actx.destination); src.start(t0 + dt);
    });
  } catch { /* audio is optional */ }
}

const VAR_LABEL = { bit: '轴尖 Bit', ring: '外圈配重', height: 'Ratchet 高度', wings: '翼片数' };
const HEIGHT_LABEL = { 55: '55（矮·重心低）', 60: '60（中）', 70: '70（高·重心高）' };
export const fmtChange = (key, v) => key === 'bit' ? TIPS[v]?.label ?? v : key === 'ring' ? `外圈 ${v}%` : key === 'height' ? HEIGHT_LABEL[v] ?? v : `${v} 片`;
const getVal = (b, key) => key === 'bit' ? b.bit : key === 'ring' ? b.blade.ring : key === 'height' ? (b.ratchet?.height ?? 60) : b.blade.wings;
function applyVal(b, key, v) {
  const n = structuredClone(b);
  if (key === 'bit') n.bit = v;
  else if (key === 'ring') n.blade.ring = v;
  else if (key === 'height') n.ratchet = { ...n.ratchet, height: v };
  else n.blade.wings = v;
  return n;
}
const ringFromBlocks = k => Math.round(Math.max(20, Math.min(85, 20 + (k / 6) * 65)));

// ---------- weight blocks (the star): drag blocks between the inner zone and the outer ring
const R_IN = 34, R_OUT = 78, R_SPLIT = 58;
const slotPos = (zone, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6; const r = zone === 'in' ? R_IN : R_OUT; return [r * Math.cos(a), r * Math.sin(a)]; };

function WeightDisc({ bey, outer, onSet, locked, onLockedTry }) {
  const svgRef = useRef();
  const [blocks, setBlocks] = useState(() => Array.from({ length: 6 }, (_, i) => ({ id: i, zone: i < outer ? 'out' : 'in' })));
  const [drag, setDrag] = useState(null); // {id, x, y}
  // keep in sync when reset from outside
  useEffect(() => {
    const cur = blocks.filter(b => b.zone === 'out').length;
    if (cur !== outer) setBlocks(Array.from({ length: 6 }, (_, i) => ({ id: i, zone: i < outer ? 'out' : 'in' })));
  }, [outer]); // eslint-disable-line react-hooks/exhaustive-deps
  const toSvg = e => {
    const r = svgRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 200 - 100, ((e.clientY - r.top) / r.height) * 200 - 100];
  };
  const positions = useMemo(() => {
    const idx = { in: 0, out: 0 };
    return Object.fromEntries(blocks.map(b => [b.id, slotPos(b.zone, idx[b.zone]++)]));
  }, [blocks]);
  const down = (e, id) => {
    if (locked) return onLockedTry();
    e.preventDefault(); svgRef.current.setPointerCapture?.(e.pointerId);
    const [x, y] = toSvg(e); setDrag({ id, x, y });
  };
  const move = e => { if (!drag) return; const [x, y] = toSvg(e); setDrag(d => ({ ...d, x, y })); };
  const up = e => {
    if (!drag) return;
    svgRef.current.releasePointerCapture?.(e.pointerId);
    const zone = Math.hypot(drag.x, drag.y) > R_SPLIT ? 'out' : 'in';
    const next = blocks.map(b => (b.id === drag.id ? { ...b, zone } : b));
    setBlocks(next); setDrag(null);
    kacha(zone === 'out' ? .8 : 1.2);
    onSet(next.filter(b => b.zone === 'out').length);
  };
  const c = bey.colors || {};
  return (
    <svg ref={svgRef} className={`wb-disc ${locked ? 'locked' : ''}`} viewBox="-100 -100 200 200" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <defs>
        <pattern id="wbTone" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1" fill="rgba(17,17,17,.25)" /></pattern>
        <linearGradient id="wbMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f9" /><stop offset=".45" stopColor="#9aa3ad" /><stop offset=".55" stopColor="#5b636d" /><stop offset="1" stopColor="#c9d0d8" /></linearGradient>
      </defs>
      <circle r="96" fill={c.primary || '#888'} stroke="#111" strokeWidth="4" />
      <circle r="96" fill="url(#wbTone)" />
      <circle r={R_SPLIT + 30} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 4" opacity=".9" />
      <circle r={R_SPLIT} fill={c.secondary || '#eee'} stroke="#111" strokeWidth="3" />
      <circle r="14" fill={c.accent || '#ffd400'} stroke="#111" strokeWidth="3" />
      <text y="-80" textAnchor="middle" className="wb-zone-l">外圈</text>
      <text y="5" textAnchor="middle" className="wb-zone-l" style={{ fontSize: 9 }}>中心</text>
      {blocks.map(b => {
        const [x, y] = drag?.id === b.id ? [drag.x, drag.y] : positions[b.id];
        return (
          <g key={b.id} className={`wb-block ${drag?.id === b.id ? 'drag' : ''}`} transform={`translate(${x} ${y})`} onPointerDown={e => down(e, b.id)}>
            <rect x="-14" y="-10" width="28" height="20" rx="3" fill="url(#wbMetal)" stroke="#111" strokeWidth="2.8" />
            <line x1="-8" y1="-4" x2="8" y2="-4" stroke="#fff" strokeWidth="2" opacity=".85" />
            <text y="6" textAnchor="middle" fontSize="8" fontWeight="900">1g</text>
          </g>
        );
      })}
    </svg>
  );
}

function InertiaGauge({ value, min, max, base }) {
  const f = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const ang = -120 + f * 240;
  const rel = Math.round((value / base - 1) * 100);
  return (
    <div className="wb-gauge">
      <svg viewBox="-60 -60 120 92">
        <path d="M -48.5 28 A 56 56 0 1 1 48.5 28" fill="#fff" stroke="#111" strokeWidth="4" />
        {Array.from({ length: 13 }, (_, i) => { const a = (-120 + i * 20 - 90) * Math.PI / 180, r1 = i % 3 ? 44 : 39; return <line key={i} x1={r1 * Math.cos(a)} y1={r1 * Math.sin(a)} x2={50 * Math.cos(a)} y2={50 * Math.sin(a)} stroke="#111" strokeWidth={i % 3 ? 2 : 3.5} />; })}
        <path d="M 30 -38 A 50 50 0 0 1 48 8" fill="none" stroke="#ff2d4a" strokeWidth="6" />
        <text x="-30" y="22" fontSize="8" fontWeight="900">小</text><text x="24" y="22" fontSize="8" fontWeight="900">大</text>
        <g className="wb-needle" style={{ transform: `rotate(${ang}deg)` }}>
          <path d="M -3 4 L 0 -46 L 3 4 Z" fill="#ff2d4a" stroke="#111" strokeWidth="1.5" />
        </g>
        <circle r="6" fill="#111" />
      </svg>
      <div className="wb-gauge-t">转动惯量计</div>
      <div className="wb-gauge-v">I = {(value * 1e6).toFixed(2)} ×10⁻⁶ kg·m² <b className={rel > 0 ? 'up' : rel < 0 ? 'down' : ''}>{rel > 0 ? `+${rel}%` : rel < 0 ? `${rel}%` : '原版'}</b></div>
    </div>
  );
}

function Skater({ open }) {
  return (
    <div className="wb-skater">
      <svg viewBox="-30 -34 60 66" width="58" height="64">
        <circle cy="-24" r="6" fill="#fff" stroke="#111" strokeWidth="2.5" />
        <path d="M0 -18 L0 6 M0 6 L-8 26 M0 6 L9 24" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
        {open ? <path d="M0 -12 L-24 -8 M0 -12 L24 -8" stroke="#111" strokeWidth="3" strokeLinecap="round" />
          : <path d="M0 -12 L-6 -4 L0 0 M0 -12 L6 -4 L0 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />}
        <path d="M-22 18 A 24 10 0 0 0 22 18" fill="none" stroke="#2f7bff" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      <div><b>像花样滑冰：</b>{open ? '手臂张开 = 转动惯量大，转得稳、不容易被撞停' : '手臂收紧 = 转动惯量小，转得快但容易被带偏'}</div>
    </div>
  );
}

// ---------- bit tray: drag a bit card onto the tip slot
function BitTray({ value, onSet, slotRef, locked, onLockedTry }) {
  const [ghost, setGhost] = useState(null);
  const start = (e, k) => {
    if (locked) return onLockedTry();
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    let moved = false;
    const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true; setGhost({ k, x: ev.clientX, y: ev.clientY }); };
    const end = ev => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
      setGhost(null);
      const r = slotRef.current?.getBoundingClientRect();
      const over = r && ev.clientX > r.left - 30 && ev.clientX < r.right + 30 && ev.clientY > r.top - 30 && ev.clientY < r.bottom + 30;
      if (over || !moved) onSet(k);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  return (
    <div className={`wb-tray ${locked ? 'locked' : ''}`}>
      {Object.entries(TIPS).map(([k, t]) => (
        <div key={k} className={`wb-bit ${value === k ? 'on' : ''}`} onPointerDown={e => start(e, k)}>
          <BitIcon tip={k} />
          <div className="wb-bit-n">{t.label}</div>
          <div className="wb-bit-d">{t.desc}</div>
        </div>
      ))}
      {ghost && createPortal(<div className="wb-ghost" style={{ left: ghost.x, top: ghost.y }}><BitIcon tip={ghost.k} big /></div>, document.body)}
    </div>
  );
}
function BitIcon({ tip, big }) {
  const s = big ? 70 : 44;
  const shape = { needle: 'M-9 -14 L9 -14 L7 -2 L0 16 L-7 -2 Z', ball: 'M-9 -14 L9 -14 L8 2 Q7 14 0 14 Q-7 14 -8 2 Z', flat: 'M-9 -14 L9 -14 L8 6 L6 14 L-6 14 L-8 6 Z', rush: 'M-10 -14 L10 -14 L10 6 L9 14 L-9 14 L-10 6 Z' }[tip];
  return (
    <svg viewBox="-16 -20 32 38" width={s} height={s}>
      <rect x="-12" y="-19" width="24" height="7" rx="2" fill="#ffd400" stroke="#111" strokeWidth="2" />
      <path d={shape} fill={tip === 'rush' ? '#2a2c31' : '#fff'} stroke="#111" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- ratchet lever: drag the handle between 3 notches
const NOTCHES = [70, 60, 55]; // top -> bottom (high -> low centre of mass)
function Lever({ value, onSet, locked, onLockedTry }) {
  const trackRef = useRef();
  const [dragY, setDragY] = useState(null);
  const idx = NOTCHES.indexOf(value);
  const yOf = i => 14 + i * 76; // px within 180 track
  const down = e => {
    if (locked) return onLockedTry();
    e.preventDefault(); trackRef.current.setPointerCapture?.(e.pointerId);
    move(e);
  };
  const move = e => {
    const r = trackRef.current.getBoundingClientRect();
    setDragY(Math.max(yOf(0), Math.min(yOf(2), e.clientY - r.top)));
  };
  const up = e => {
    if (dragY == null) return;
    trackRef.current.releasePointerCapture?.(e.pointerId);
    const i = [0, 1, 2].reduce((a, b) => (Math.abs(yOf(b) - dragY) < Math.abs(yOf(a) - dragY) ? b : a), 0);
    setDragY(null);
    if (NOTCHES[i] !== value) { kacha(.7); onSet(NOTCHES[i]); }
  };
  const y = dragY ?? yOf(idx < 0 ? 1 : idx);
  return (
    <div className={`wb-lever ${locked ? 'locked' : ''}`}>
      <div className="wb-lever-t">Ratchet 高度</div>
      <div className="wb-lever-body">
        <div ref={trackRef} className="wb-lever-track" onPointerDown={down} onPointerMove={e => dragY != null && move(e)} onPointerUp={up} onPointerCancel={up}>
          {NOTCHES.map((n, i) => <div key={n} className="wb-notch" style={{ top: yOf(i) }} />)}
          <div className={`wb-handle ${dragY != null ? 'drag' : ''}`} style={{ top: y }}><span>{value}</span></div>
        </div>
        <div className="wb-lever-labels">
          {NOTCHES.map((n, i) => <div key={n} style={{ top: yOf(i) }} className={n === value ? 'on' : ''}>{n}<small>{['重心 高', '重心 中', '重心 低'][i]}</small></div>)}
        </div>
      </div>
    </div>
  );
}

function WingToggle({ bey, value, onSet, locked, onLockedTry }) {
  return (
    <div className={`wb-wings ${locked ? 'locked' : ''}`}>
      {[2, 3, 4].map(n => {
        const spec = { ...specFromBey(bey), wings: n };
        const k = 1 / .032 * 40;
        return (
          <button key={n} className={`wb-wing ${value === n ? 'on' : ''}`} onClick={() => (locked ? onLockedTry() : onSet(n))}>
            <svg viewBox="-46 -46 92 92" width="64" height="64">
              {Array.from({ length: n }, (_, i) => <polygon key={i} points={wingOutline(spec, i).map(([x, y]) => `${x * k},${-y * k}`).join(' ')} fill={value === n ? '#ffd400' : '#fff'} stroke="#111" strokeWidth="3" strokeLinejoin="round" />)}
              <circle r="17" fill="#111" />
            </svg>
            <b>{n} 片</b>
          </button>
        );
      })}
    </div>
  );
}

export const QUESTIONS = [
  { key: 'bit', icon: '🌀', q: '换个轴尖，会转得更久吗？', hint: '尖轴、圆轴、平轴、冲刺轴' },
  { key: 'ring', icon: '⚖️', q: '重量放外圈，会更稳吗？', hint: '拖动金属配重块' },
  { key: 'height', icon: '📏', q: 'Ratchet 高一点会怎样？', hint: '拉动高度拉杆' },
  { key: 'wings', icon: '🪽', q: '翼片多一点会更猛吗？', hint: '2 片、3 片还是 4 片' },
];
export { VAR_LABEL };

/** Step ① — big comic question cards. */
export function QuestionPicker({ onPick }) {
  return (
    <div className="wb-qs">
      {QUESTIONS.map((x, i) => (
        <button key={x.key} className="wb-q" style={{ '--i': i }} onClick={() => { kacha(1 + i * .1); onPick(x.key); }}>
          <span className="wb-q-icon">{x.icon}</span>
          <span className="wb-q-text">{x.q}</span>
          <span className="wb-q-hint">{x.hint} ▶</span>
        </button>
      ))}
    </div>
  );
}

/** The doctor explains the one-variable rule once, kindly, with a tiny 2-panel comic. */
export function DoctorRule({ Face }) {
  return (
    <div className="wb-rule">
      <div className="wb-rule-top">{Face}<div className="wb-rule-say">做实验的秘诀：<b>一次只改一个地方！</b>如果同时换了轴尖又换了配重，赢了也不知道是谁的功劳～</div></div>
      <div className="wb-rule-comic">
        <div className="wb-rule-panel bad"><span className="wb-rule-parts"><i>🌀</i>+<i>⚖️</i></span><span className="wb-rule-q">？？</span><small>改了两个 → 不知道是谁</small></div>
        <div className="wb-rule-panel good"><span className="wb-rule-parts"><i>🌀</i></span><span className="wb-rule-q">原来是它！</span><small>只改一个 → 一清二楚</small></div>
      </div>
    </div>
  );
}

/**
 * Step ② — ONE control for the chosen variable + live 3D preview + before/after chips.
 * <Workbench base={bey} varKey="bit"|"ring"|"height"|"wings" onChange={(variantBey, change|null)=>…} />
 * change = {key, from, to, label, fromLabel, toLabel}
 */
export default function Workbench({ base, varKey, onChange }) {
  const [to, setTo] = useState(null); // new value for varKey (null = unchanged)
  const [blocks, setBlocks] = useState(null);
  const [snap, setSnap] = useState(0);
  const slotRef = useRef();
  useEffect(() => { setTo(null); setBlocks(null); }, [varKey]);
  const from = getVal(base, varKey);
  const variant = useMemo(() => (to != null && to !== from ? applyVal(base, varKey, to) : base), [base, varKey, to, from]);
  const change = to != null && to !== from ? { key: varKey, from, to, label: VAR_LABEL[varKey], fromLabel: fmtChange(varKey, from), toLabel: fmtChange(varKey, to) } : null;
  useEffect(() => { onChange?.(variant, change); }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseOuter = Math.round(Math.max(0, Math.min(6, ((base.blade.ring - 20) / 65) * 6)));
  const outer = blocks ?? baseOuter;
  const inertia = useMemo(() => {
    const I = b => makePart(specFromBey(b)).inertia[2];
    return { v: I(variant), base: I(base), lo: I(applyVal(base, 'ring', 20)), hi: I(applyVal(base, 'ring', 85)) };
  }, [base, variant]);
  const no = () => {};

  const control = {
    bit: <div className="wb-ctl wb-ctl-bit">
      <div ref={slotRef} key={snap} className={`wb-slot ${snap ? 'snap' : ''}`}><BitIcon tip={variant.bit} big /><div><b>轴尖插槽</b><br /><small>把下面的轴尖<b>拖进来</b>（或直接点）</small></div></div>
      <BitTray value={variant.bit} slotRef={slotRef} onSet={k => { kacha(); setSnap(x => x + 1); setTo(k); }} locked={false} onLockedTry={no} />
    </div>,
    ring: <div className="wb-ctl wb-ctl-ring">
      <div className="wb-weights-row">
        <WeightDisc bey={variant} outer={outer} locked={false} onLockedTry={no} onSet={k => { setBlocks(k); setTo(k === baseOuter ? base.blade.ring : ringFromBlocks(k)); }} />
        <div className="wb-weights-side">
          <InertiaGauge value={inertia.v} min={inertia.lo} max={inertia.hi} base={inertia.base} />
          <div className="wb-ring">外圈 {outer}/6 块 · 配重 {variant.blade.ring}%</div>
        </div>
      </div>
      <Skater open={outer >= 3} />
    </div>,
    height: <div className="wb-ctl wb-ctl-height">
      <Lever value={variant.ratchet?.height ?? 60} onSet={v => setTo(v)} locked={false} onLockedTry={no} />
      <div className="wb-height-tip"><b>Ratchet 越高</b>，陀螺的重心越高：更容易被撞到上半身、也更容易歪。<br /><b>越矮</b>重心越低，站得更稳。</div>
    </div>,
    wings: <div className="wb-ctl wb-ctl-wings">
      <WingToggle bey={base} value={variant.blade.wings} onSet={n => { kacha(1.1); setTo(n); }} locked={false} onLockedTry={no} />
      <div className="wb-height-tip">翼片越多，<b>撞到对手的机会</b>越多，但每一片更小；翼片少，每次撞击更集中。</div>
    </div>,
  }[varKey];

  return (
    <div className="wb wb-one">
      <section className="wb-card wb-control"><h4>{QUESTIONS.find(x => x.key === varKey)?.icon} 动手改一改：{VAR_LABEL[varKey]}</h4>{control}</section>
      <section className="wb-card wb-center">
        <div className="wb-preview"><BeyShowcase bey={variant} tilt={.3} zoom={1.2} background standalone /></div>
        <div className="wb-ba">
          <span className="wb-ba-chip a"><small>原版</small>{fmtChange(varKey, from)}</span>
          <b>→</b>
          <span className={`wb-ba-chip b ${change ? 'on' : ''}`}><small>改装</small>{change ? change.toLabel : '还没改'}</span>
          {change && <button className="wb-undo" onClick={() => { setTo(null); setBlocks(null); }}>↩</button>}
        </div>
      </section>
    </div>
  );
}
