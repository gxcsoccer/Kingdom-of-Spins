import {getLocale,tr} from '../i18n/index.js';
import './minimap.css';
import {SCENES} from '../game/scenes.js';
import {compass} from './quest.js';
import {mapLabels} from './mapLabels.js';
// 区域小地图：按真实方位画出场景和道路；去过的点亮、相邻的显示“？”、其余盖迷雾；可点相邻或去过的地点走过去。
// props: regionId, here, visited:[keys], hintScene?, onGo(key), compact?
export default function MiniMap({regionId, here, visited = [], hintScene, onGo, compact}) {
  const list = SCENES[regionId] || [], byKey = Object.fromEntries(list.map(s => [s.key, s]));
  const seen = new Set([...visited, here]), near = new Set(byKey[here]?.exits || []);
  const known = k => seen.has(k) || near.has(k);
  const W = 300, H = getLocale()==='en'?320:240, P = 18, X = p => P + p.x * (W - 2 * P), Y = p => P + p.y * (H - 2 * P);
  const labels=mapLabels(list.filter(s=>known(s.key)).map(s=>({...s,x:X(s.pos),y:Y(s.pos)})),{width:W,height:H,here,hereText:tr('你在这里'),english:getLocale()==='en'});
  const edges = [];
  for (const s of list) for (const e of s.exits) if (s.key < e && byKey[e] && (known(s.key) || known(e))) edges.push([s, byKey[e]]);
  return (
    <div className={`mm ${compact ? 'compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr("区域小地图")}>
        <defs><pattern id="mmFog" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="rgba(255,255,255,.18)"/></pattern></defs>
        <rect x="0" y="0" width={W} height={H} rx="10" fill="#1b2a3a"/>
        <rect x="0" y="0" width={W} height={H} rx="10" fill="url(#mmFog)"/>
        {edges.map(([a, b], i) => <line key={i} x1={X(a.pos)} y1={Y(a.pos)} x2={X(b.pos)} y2={Y(b.pos)}
          stroke={seen.has(a.key) && seen.has(b.key) ? '#ffd400' : 'rgba(255,255,255,.35)'} strokeWidth={seen.has(a.key) && seen.has(b.key) ? 3 : 2} strokeDasharray={seen.has(a.key) && seen.has(b.key) ? '' : '4 4'}/>)}
        {list.map(s => {
          const isHere = s.key === here, v = seen.has(s.key), n = near.has(s.key), can = !isHere && (v || n);
          if (!v && !n) return null;
          return <g key={s.key} transform={`translate(${X(s.pos)} ${Y(s.pos)})`} style={{cursor: isHere ? 'default' : 'pointer'}} onClick={() => !isHere && onGo?.(s.key)}>
            <title>{s.title}{v ? '' : tr("（还没去过）")}{s.alt ? tr(" · 海拔约 {0} 米", [s.alt]) : ''}</title>
            {!compact&&<line x1="0" y1="0" x2={Math.max(labels[s.key].x,Math.min(X(s.pos),labels[s.key].x+labels[s.key].w))-X(s.pos)} y2={Math.max(labels[s.key].y,Math.min(Y(s.pos),labels[s.key].y+labels[s.key].h))-Y(s.pos)} stroke="#a5b7c7" strokeWidth="1" opacity=".65" pointerEvents="none"/>}
            {hintScene === s.key && <circle r="15" fill="none" stroke="#ff2d4a" strokeWidth="3" className="mm-pulse"/>}
            <circle r={isHere ? 9 : 7} fill={isHere ? '#ff2d4a' : v ? '#ffd400' : '#3a4b5e'} stroke="#111" strokeWidth="2"/>
            {/* 相邻地点和“走去”按钮一样显示名字，孩子才能把线索里的方向和地图对上 */}
            {!compact && <g className="mm-label" transform={`translate(${labels[s.key].x-X(s.pos)} ${labels[s.key].y-Y(s.pos)})`}>
              {labels[s.key].lines.map((line,i)=><text key={i} x={labels[s.key].w/2} y={labels[s.key].font+2+i*labels[s.key].lineHeight} textAnchor="middle" fontSize={labels[s.key].font} fontWeight="900" fill={isHere&&i===labels[s.key].lines.length-1?'#ffd400':v?'#fff':'#9fd8ff'} stroke="#111" strokeWidth="3" paintOrder="stroke">{line}</text>)}
            </g>}
            {compact&&isHere&&<text y={24} textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffd400">{tr('你在这里')}</text>}
          </g>;
        })}
        <g transform={`translate(${W - 26} 26)`} aria-hidden="true">
          <circle r="16" fill="#fff" stroke="#111" strokeWidth="2"/>
          <path d="M0 -12 L4 0 L0 12 L-4 0 Z" fill="#111"/><path d="M0 -12 L4 0 L-4 0 Z" fill="#ff2d4a"/>
          <text y="-17" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff" stroke="#111" strokeWidth="2.5" paintOrder="stroke">{tr("北")}</text>
        </g>
      </svg>
    </div>
  );
}
export {compass};
