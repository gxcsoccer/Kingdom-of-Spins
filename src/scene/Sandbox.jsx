import { useMemo, useState } from 'react';
import BattleScene from './BattleScene.jsx';
import BeyShowcase, { ShowcaseCanvas } from './BeyShowcase.jsx';
import { createMockPlayer } from './mockPlayer.js';
import ReplayViewer from './ReplayViewer.jsx';
import HeroCards from '../fusion/HeroCards.jsx';
import { getCard } from '../knowledge/cards.js';
import '../styles/theme.css';
import '../fusion/fusion.css';
import { BEYS } from '../game/beys.js';

// Art sandbox: BattleScene driven by the mock player + a row of showcases.
const FUSED = [
  { id: 'fishgoon', name: 'Fishgoon', zh: '鱼龙', type: 'attack', parents: ['fish', 'dragoon'], colors: { primary: '#14c9a5', secondary: '#c9d6ff', accent: '#00e5ff' },
    blade: { wings: 3, reach: .028, ring: 74, mass: 33, style: 'attack' }, ratchet: { height: 55, prongs: 4 }, bit: 'needle' },
  { id: 'ninjapuff', name: 'NinjaPuff', zh: '忍者泡芙', type: 'defense', parents: ['goatpuff', 'ninjamight'], colors: { primary: '#f2b632', secondary: '#e7d9ff', accent: '#d35bff' },
    blade: { wings: 4, reach: .027, ring: 60, mass: 35, style: 'defense' }, ratchet: { height: 60, prongs: 5 }, bit: 'ball' },
];
function ReplaySandbox() {
  const data = useMemo(() => {
    const beys = [BEYS.dragoon, BEYS.fish];
    const mp = createMockPlayer({ beys, duration: 12, loop: false });
    const samples = [];
    for (let t = 0; t <= 12.0001; t += 1 / 60) samples.push(mp.getState(t));
    const hits = mp.events.filter(e => e.type === 'collision');
    const moments = [
      { id: 'm1', time: hits[0]?.time ?? 2, title: '第一次正面冲撞！' },
      { id: 'm2', time: hits[2]?.time ?? 6, title: '外圈重量让 Fish 扛住了' },
      { id: 'm3', time: 12, title: 'XTREME 终结' },
    ];
    return { beys, samples, events: mp.events, moments };
  }, []);
  const [active, setActive] = useState(null);
  const [cursor, setCursor] = useState(0);
  return (
    <div style={{ background: '#fbf8f1', minHeight: '100vh', padding: 20, fontFamily: 'system-ui' }}>
      <div style={{ height: location.search.includes('fold') ? 900 : 0 }}>(filler above the fold)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {data.moments.map(m => <button key={m.id} onClick={() => setActive(m.id)}>{m.title}</button>)}
        <span>onSeek: {cursor.toFixed(2)}s</span>
      </div>
      <ReplayViewer beys={data.beys} samples={data.samples} events={data.events} moments={data.moments} activeMoment={active} onSeek={setCursor} />
    </div>
  );
}

const LOOKS = [
  { id: 'lk1', name: 'Neon Claw', zh: '霓虹龙爪', type: 'attack', colors: { primary: '#1b1f5e', secondary: '#7cf9ff', accent: '#00f0ff' }, look: { shape: 'claw', finish: 'neon', emblem: 'dragon', pattern: 'bolts' }, blade: { wings: 3, reach: .029, ring: 70, mass: 34, style: 'attack' }, ratchet: { height: 60, prongs: 3 }, bit: 'flat' },
  { id: 'lk2', name: 'Crystal Wave', zh: '水晶海浪', type: 'stamina', colors: { primary: '#7fd8ff', secondary: '#ffffff', accent: '#2f7bff' }, look: { shape: 'wing', finish: 'crystal', emblem: 'wave', pattern: 'dots' }, blade: { wings: 4, reach: .026, ring: 80, mass: 30, style: 'stamina' }, ratchet: { height: 55, prongs: 4 }, bit: 'needle' },
  { id: 'lk3', name: 'Iron Shield', zh: '钢铁巨盾', type: 'defense', colors: { primary: '#9aa3ad', secondary: '#f2b632', accent: '#ff7a3d' }, look: { shape: 'shield', finish: 'metal', emblem: 'mountain', pattern: 'stripes' }, blade: { wings: 2, reach: .027, ring: 60, mass: 37, style: 'defense' }, ratchet: { height: 60, prongs: 5 }, bit: 'ball' },
  { id: 'lk4', name: 'Blaze Fang', zh: '烈焰獠牙', type: 'attack', colors: { primary: '#ff2d4a', secondary: '#ffd400', accent: '#ffb300' }, look: { shape: 'fang', finish: 'toon', emblem: 'tiger', pattern: 'flames' }, blade: { wings: 3, reach: .028, ring: 65, mass: 35, style: 'attack' }, ratchet: { height: 60, prongs: 3 }, bit: 'rush' },
  { id: 'lk5', name: 'Phoenix Flame', zh: '凤凰火舌', type: 'balance', colors: { primary: '#ff7a3d', secondary: '#fff3a6', accent: '#ffd400' }, look: { shape: 'flame', finish: 'neon', emblem: 'phoenix', pattern: 'none' }, blade: { wings: 3, reach: .027, ring: 62, mass: 33, style: 'balance' }, ratchet: { height: 60, prongs: 3 }, bit: 'ball' },
  { id: 'lk6', name: 'Shark Blade', zh: '深海鲨刃', type: 'balance', colors: { primary: '#14c9a5', secondary: '#e0fff6', accent: '#0b3d5c' }, look: { shape: 'blade', finish: 'metal', emblem: 'shark', pattern: 'stripes' }, blade: { wings: 4, reach: .027, ring: 62, mass: 33, style: 'balance' }, ratchet: { height: 55, prongs: 4 }, bit: 'ball' },
];
export default function Sandbox() {
  const ids = Object.keys(BEYS);
  if (typeof location !== 'undefined' && location.search.includes('cards')) {
    const ks = ['ph-inertia', 'ph-momentum', 'ph-friction-area'].map(getCard).filter(Boolean);
    const cands = [LOOKS[0], LOOKS[1], LOOKS[2]].map((b, i) => ({ ...b, parents: ['dragoon', 'fish'], why: '刃重更大、半径更长，撞击时动量更大，更难被撞飞。', tradeoff: '转速掉得更快一点。', knowledge: ks.slice(0, 2 + (i % 2)) }));
    return <div className="fusion" style={{ height: '100vh', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#2a2d3a' }}><div className="cand-zone" style={{ flex: 1 }}><HeroCards candidates={cands} parents={[BEYS.dragoon, BEYS.fish]} onPick={() => {}} /></div></div>;
  }
  if (typeof location !== 'undefined' && location.search.includes('compare')) {
    const ids6 = ['dragoon', 'fish', 'goatpuff', 'ninjamight', 'titan', 'bossdragoon'];
    return (
      <div style={{ background: '#fbf8f1', height: '100vh', padding: 8, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 8 }}>
        <ShowcaseCanvas />
        {ids6.map(id => <div key={id} style={{ border: '4px solid #111', display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative', minHeight: 0 }}>
          <img src={`/art/beys/${id}.png`} style={{ width: '100%', height: '100%', objectFit: 'contain', minHeight: 0 }} />
          <div style={{ position: 'relative', borderLeft: '3px dashed #111' }}><BeyShowcase bey={BEYS[id]} zoom={1.35} tilt={.5} rpm={900} background={false} /></div>
          <b style={{ position: 'absolute', left: 6, top: 4, font: '900 14px system-ui' }}>{BEYS[id].zh}</b>
        </div>)}
      </div>
    );
  }
  if (typeof location !== 'undefined' && location.search.includes('grid')) {
    const SH = ['blade', 'claw', 'fang', 'wing', 'flame', 'shield'], FI = ['toon', 'metal', 'crystal', 'neon'];
    const PAL = [['#16161a', '#e8202a', '#ff7a3d'], ['#2f7bff', '#ffffff', '#ffd400'], ['#ff2d4a', '#ffd400', '#111111'], ['#14c9a5', '#e0fff6', '#0b3d5c'], ['#8a3cff', '#ffd400', '#ff5bd0'], ['#16161a', '#ffd400', '#e8202a']];
    const EM = ['dragon', 'wolf', 'shark', 'eagle', 'phoenix', 'mountain'], PT = ['bolts', 'stripes', 'flames', 'dots', 'none', 'bolts'];
    const W = { blade: 3, claw: 3, fang: 3, wing: 4, flame: 3, shield: 2 };
    return (
      <div style={{ background: '#fbf8f1', height: '100vh', padding: 6, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '60px repeat(6,1fr)', gridTemplateRows: '20px repeat(4,1fr)', gap: 4, font: '900 12px system-ui' }}>
        <ShowcaseCanvas />
        <span />{SH.map(x => <span key={x} style={{ textAlign: 'center' }}>{x}</span>)}
        {FI.map(f => [<span key={f} style={{ alignSelf: 'center' }}>{f}</span>, ...SH.map((sh, j) => {
          const [p, s2, a] = PAL[j];
          const bey = { id: `g-${sh}-${f}`, name: sh, type: 'attack', colors: { primary: p, secondary: s2, accent: a }, look: { shape: sh, finish: f, emblem: EM[j], pattern: PT[j] }, blade: { wings: W[sh], reach: .028, ring: 65, mass: 34, style: 'attack' }, ratchet: { height: 60, prongs: 3 }, bit: 'flat' };
          return <div key={bey.id} style={{ border: '3px solid #111', position: 'relative', minHeight: 0 }}><BeyShowcase bey={bey} zoom={1.45} rpm={1800} standalone={location.search.includes('solo') && f === 'toon'} /></div>;
        })])}
      </div>
    );
  }
  if (typeof location !== 'undefined' && location.search.includes('looks')) {
    const lp = createMockPlayer({ beys: [LOOKS[0], LOOKS[2]], loop: true });
    return (
      <div style={{ background: '#fbf8f1', height: '100vh', display: 'grid', gridTemplateRows: '1fr 1fr', gap: 8, padding: 8, boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          {LOOKS.map(b => <div key={b.id} style={{ border: '4px solid #111', position: 'relative' }}><BeyShowcase bey={b} zoom={1.4} rpm={2500} /><b style={{ position: 'absolute', left: 4, bottom: 2, fontSize: 12 }}>{b.zh}</b></div>)}
        </div>
        <div style={{ border: '4px solid #111' }}><BattleScene player={lp} /></div>
      </div>
    );
  }
  if (typeof location !== 'undefined' && location.search.includes('replay')) return <ReplaySandbox />;
  if (typeof location !== 'undefined' && location.search.includes('big')) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 12, background: '#fbf8f1', height: '100vh', boxSizing: 'border-box' }}>
        {[...FUSED, ...ids.slice(0, 4).map(id => BEYS[id])].map(b => (
          <div key={b.id} style={{ border: '5px solid #111', boxShadow: '8px 8px 0 #111', position: 'relative' }}>
            <BeyShowcase bey={b} zoom={1.6} rpm={location.search.includes('spin') ? 4000 : undefined} />
          </div>
        ))}
      </div>
    );
  }
  const [pair, setPair] = useState(['dragoon', 'fish']);
  const [reason, setReason] = useState('xtreme');
  const [shared, setShared] = useState(true);
  const player = useMemo(() => createMockPlayer({ beys: pair.map(id => BEYS[id]), finishReason: reason }), [pair, reason]);
  return (
    <div style={{ fontFamily: 'system-ui', background: '#fbf8f1', minHeight: '100vh' }}>
      {shared && <ShowcaseCanvas />}
      <div style={{ height: '68vh', borderBottom: '6px solid #111' }}>
        <BattleScene player={player} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {[0, 1].map(k => (
          <select key={k} value={pair[k]} onChange={e => setPair(p => p.map((v, i) => (i === k ? e.target.value : v)))}>
            {ids.map(id => <option key={id}>{id}</option>)}
          </select>
        ))}
        <select value={reason} onChange={e => setReason(e.target.value)}>
          {['xtreme', 'over', 'spin', 'judge'].map(r => <option key={r}>{r}</option>)}
        </select>
        <label><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> shared canvas</label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, padding: 10 }}>
        {ids.map(id => (
          <div key={id} style={{ border: '4px solid #111', boxShadow: '6px 6px 0 #111', height: 200, position: 'relative' }}>
            <BeyShowcase bey={BEYS[id]} />
            <div style={{ position: 'absolute', left: 6, bottom: 4, fontWeight: 900 }}>{BEYS[id].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
