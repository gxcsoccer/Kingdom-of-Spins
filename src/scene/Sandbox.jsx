import { useMemo, useState } from 'react';
import BattleScene from './BattleScene.jsx';
import BeyShowcase, { ShowcaseCanvas } from './BeyShowcase.jsx';
import { createMockPlayer } from './mockPlayer.js';
import { BEYS } from '../game/beys.js';

// Art sandbox: BattleScene driven by the mock player + a row of showcases.
const FUSED = [
  { id: 'fishgoon', name: 'Fishgoon', zh: '鱼龙', type: 'attack', parents: ['fish', 'dragoon'], colors: { primary: '#14c9a5', secondary: '#c9d6ff', accent: '#00e5ff' },
    blade: { wings: 3, reach: .028, ring: 74, mass: 33, style: 'attack' }, ratchet: { height: 55, prongs: 4 }, bit: 'needle' },
  { id: 'ninjapuff', name: 'NinjaPuff', zh: '忍者泡芙', type: 'defense', parents: ['goatpuff', 'ninjamight'], colors: { primary: '#f2b632', secondary: '#e7d9ff', accent: '#d35bff' },
    blade: { wings: 4, reach: .027, ring: 60, mass: 35, style: 'defense' }, ratchet: { height: 60, prongs: 5 }, bit: 'ball' },
];
export default function Sandbox() {
  const ids = Object.keys(BEYS);
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
