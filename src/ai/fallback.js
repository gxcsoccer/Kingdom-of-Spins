// Pure, deterministic helpers shared by the worker (worker/ai.js) and the browser client.
// Used for validation/repair of model output and as the template fallback when the model fails.
import {specFromBey, STYLES} from '../physics/model.js';
import {CARDS, getCard, relevantCards} from '../knowledge/cards.js';

export const STYLE_ZH = {attack:'攻击型', defense:'防御型', stamina:'持久型', balance:'平衡型'};
const HEX = /^#[0-9a-f]{6}$/i;
// Strip inline card ids like (ph-inertia) the model sometimes echoes into prose.
const clean = v => v.replace(/[（(]?\b(?:bx|ph|mt|sm|gd)-[a-z0-9-]+\b[)）]?/g,'').replace(/\s{2,}/g,' ').trim();
const str = (v, max, d='') => (typeof v==='string' && clean(v) ? clean(v).slice(0, max) : d);
const round = (v, k) => Math.round(v * 10**k) / 10**k;

// ── Fusion names in the kid's style ──
const CANON = {'fish+dragoon':'Fishgoon', 'dragoon+fish':'Fishgoon', 'goatpuff+ninjamight':'NinjaPuff', 'ninjamight+goatpuff':'NinjaPuff'};
const camel = s => String(s).replace(/[^A-Za-z ]/g,'').split(/(?=[A-Z])|\s+/).filter(Boolean);
const tail = w => { const m = /[^aeiou][aeiou]+[^aeiou]*$/i.exec(w); return m && m.index>0 ? m[0] : w; };
const cap = w => w ? w[0].toUpperCase()+w.slice(1).toLowerCase() : w;
export function fusionName(a, b) {
  const key = `${a?.id}+${b?.id}`;
  if (CANON[key]) return CANON[key];
  const A = camel(a?.name||'Spin'), B = camel(b?.name||'Top');
  if (A.length>1 && B.length>1) return cap(B[0]) + cap(A.at(-1));           // GoatPuff + NinjaMight → NinjaPuff
  if (A.length>1) return cap(A[0]) + tail(B.join('')).toLowerCase();
  return cap(A[0]) + tail(B.at(-1)).toLowerCase();                            // Fish + Dragoon → Fishgoon
}

// ── Candidate validation / repair ──
export function keptParts(parents, keepParent=0) {
  const p = parents[keepParent===1?1:0] || parents[0] || {};
  return {ratchet: {height: p.ratchet?.height ?? 60, prongs: p.ratchet?.prongs ?? 3}, bit: p.bit || 'ball'};
}
function shortHash(s) { let h=2166136261; for (const ch of s) { h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(36).slice(0,6); }

export function sanitizeCandidate(raw={}, parents=[], keepParent=0, fusedBy='ai') {
  const [a={}, b={}] = parents;
  const src = raw.blade && typeof raw.blade==='object' ? {...raw, ...raw.blade} : raw;
  const style = STYLES.includes(src.style) ? src.style : (STYLES.includes(src.type) ? src.type : (a.blade?.style||'balance'));
  const spec = specFromBey({blade:{wings:src.wings, reach:src.reach, ring:src.ring, mass:src.mass, style}});
  const blade = {wings: spec.wings, reach: round(spec.reach,4), ring: Math.round(spec.ring), mass: round(spec.bladeMass,1), style: spec.style};
  const pc = a.colors||{}, bc = b.colors||{}, rc = raw.colors||{};
  const colors = {
    primary: HEX.test(rc.primary) ? rc.primary : (pc.primary||'#2f7bff'),
    secondary: HEX.test(rc.secondary) ? rc.secondary : (bc.secondary||pc.secondary||'#ffffff'),
    accent: HEX.test(rc.accent) ? rc.accent : (bc.accent||pc.accent||'#ffd400'),
  };
  const name = str(raw.name, 20, fusionName(a,b)).replace(/[^\w一-龥 \-]/g,'') || fusionName(a,b);
  const cardIds = (Array.isArray(raw.cards)?raw.cards:Array.isArray(raw.knowledge)?raw.knowledge.map(k=>typeof k==='string'?k:k?.id):[])
    .filter(id=>getCard(id)).slice(0,2);
  if (!cardIds.length) cardIds.push(defaultCardFor(blade));
  const {ratchet, bit} = keptParts(parents, keepParent);
  return {
    id: 'fusion-' + name.toLowerCase().replace(/[^a-z0-9]+/g,'') + '-' + shortHash(JSON.stringify(blade)+name+bit),
    name, zh: str(raw.zh, 8, `${a.zh||''}${b.zh?'·'+b.zh:''}`.slice(0,8)),
    type: blade.style, colors, blade, ratchet, bit,
    lore: str(raw.lore, 60, `${a.name||'A'} 和 ${b.name||'B'} 的刃合体而成。`),
    why: str(raw.why, 90, ''), tradeoff: str(raw.tradeoff, 70, ''),
    prediction: str(raw.prediction, 60, ''),
    parents: [a.id, b.id].filter(Boolean), keptFrom: (parents[keepParent===1?1:0]||{}).id, fusedBy,
    knowledge: cardIds.map(id=>{const c=getCard(id);return {id:c.id,title:c.title,body:c.body,layer:c.layer};}),
  };
}
function defaultCardFor(blade) {
  if (blade.style==='attack') return 'ph-momentum';
  if (blade.style==='stamina') return 'ph-inertia';
  if (blade.style==='defense') return 'ph-mass-tradeoff';
  return 'bx-types';
}

// ── Wish understanding (keywords) ──
const WANTS = {
  stamina: ['持久','久','耐','不停','转得长','续航','省力','鱼'],
  attack: ['攻击','撞','冲','快','猛','打飞','撞飞','进攻','爆发','厉害','强','龙'],
  defense: ['防守','防御','重','顶','不怕','扛','稳','盾','硬','坚固'],
  balance: ['平衡','都要','全能','均衡'],
};
export function wishStyles(wish='') {
  const t = String(wish).toLowerCase(), score = {};
  for (const [k, ws] of Object.entries(WANTS)) score[k] = ws.reduce((s,w)=>s+(t.includes(w)?1:0),0);
  return Object.entries(score).filter(([,s])=>s>0).sort((x,y)=>y[1]-x[1]).map(([k])=>k);
}
export const CLARIFY = {
  reply: '收到！融合博士想先确认一下——',
  question: '你最想要新陀螺在哪方面超厉害？',
  options: ['转得最久，熬赢对手 🌀', '冲上去把对手撞飞 💥', '稳稳站住，谁也撞不动 🛡️'],
};
export function needsClarify(wish='', history=[]) {
  const asked = (history||[]).some(h=>h.role==='assistant' && h.question);
  if (asked) return false;
  return wishStyles(wish).length===0;
}

// ── Template fusion (deterministic) ──
const TARGET = {
  attack:  {wings:3, reach:.0295, ring:62, mass:36, why:'刃边更靠外、更重，冲撞时能把更多动量传给对手。', tradeoff:'冲得猛也更容易撞墙掉转。', cards:['ph-momentum','ph-impulse']},
  stamina: {wings:4, reach:.0250, ring:84, mass:31, why:'外形更圆、重量集中在外圈，转动惯量大，转速掉得慢。', tradeoff:'被猛撞时容易被推走。', cards:['ph-inertia','ph-figure-skater']},
  defense: {wings:2, reach:.0270, ring:66, mass:39, why:'刃更重更厚，被撞时速度改变更小，不容易被撞飞。', tradeoff:'太重的刃同样发射力转得没那么快。', cards:['ph-mass-tradeoff','ph-momentum']},
  balance: {wings:3, reach:.0270, ring:70, mass:34, why:'各项参数取中间值，攻守都能应付。', tradeoff:'没有特别突出的强项。', cards:['bx-types','ph-angular-momentum']},
};
const VERSION_ZH = {attack:'冲锋版', stamina:'持久版', defense:'铁壁版', balance:'均衡版'};
export function templateCandidates(parents=[], wish='', keepParent=0) {
  const [a={}, b={}] = parents;
  const avg = k => ((a.blade?.[k] ?? TARGET.balance[k]) + (b.blade?.[k] ?? TARGET.balance[k])) / 2;
  const order = [...new Set([...wishStyles(wish), a.blade?.style, b.blade?.style, 'balance', 'attack', 'stamina'].filter(s=>STYLES.includes(s)))].slice(0,3);
  const base = fusionName(a,b);
  return order.map((style,i) => {
    const t = TARGET[style], mix = (k)=>avg(k)*.4 + t[k]*.6;
    return sanitizeCandidate({
      name: i===0 ? base : `${base} ${['','II','X'][i]}`.trim(), zh: VERSION_ZH[style],
      style, wings: t.wings, reach: mix('reach'), ring: mix('ring'), mass: mix('mass'),
      colors: i===0 ? {primary:a.colors?.primary, secondary:b.colors?.secondary, accent:b.colors?.accent}
            : i===1 ? {primary:b.colors?.primary, secondary:a.colors?.secondary, accent:a.colors?.accent}
            : {primary:a.colors?.accent, secondary:'#ffffff', accent:b.colors?.primary},
      why: t.why, tradeoff: t.tradeoff, cards: t.cards,
      lore: `${a.name||'A'} 和 ${b.name||'B'} 的刃合体，走${STYLE_ZH[style]}路线。`,
    }, parents, keepParent, 'template');
  });
}
export function templateFusion({parents=[], wish='', history=[], keepParent=0}) {
  if (needsClarify(wish, history)) return {...CLARIFY, fallback:true};
  const candidates = templateCandidates(parents, wish, keepParent);
  return {reply: `融合博士用公式算出了 ${candidates.length} 个方案！每个都有不同的取舍，你来选。`, candidates, fallback:true};
}

// ── Commentary ── (body index 0 is ALWAYS the kid's own bey)
const REASON_ZH = {xtreme:'Xtreme 终结', over:'Over 出界', spin:'Spin 停转', judge:'时间到·转速判定', burst:'Burst 爆裂'};
export const fmtT = t => `${(+t||0).toFixed(1)} 秒`;
export const fmtRpm = r => `约 ${(Math.round(Math.abs(+r||0)/100)*100).toLocaleString('en-US')} 转/分`;
export const fmtV = v => `${(+v||0).toFixed(1)} m/s`;
// Kid-facing number cleanup for model prose: 0.4632秒 → 0.5 秒, 6515rpm → 约 6,500 转/分, 1.54m/s → 1.5 m/s.
export function tidyNumbers(text='') {
  return String(text)
    .replace(/(\d+\.\d{2,})\s*(秒|s)(?![a-z])/g, (_,n)=>fmtT(n))
    .replace(/约?\s*(\d[\d,]{2,})\s*(rpm|RPM|转\/分|转每分)/g, (_,n)=>fmtRpm(n.replace(/,/g,'')))
    .replace(/(\d+\.\d{2,})\s*m\/s/g, (_,n)=>fmtV(n));
}
const BIT_ZH = {needle:'尖轴', ball:'圆轴', flat:'平轴', rush:'冲刺轴'};
// One concrete change to the PLAYER's bey (index 0), chosen from how the round went.
export function suggestTryNext(summary={}, names=['你的陀螺']) {
  const me = `你的 ${names[0]||'陀螺'}`, p = summary.parts?.[0] || {}, r = summary.result || {};
  const won = r.winner===0, tip = p.tip, ring = +p.ring||60, h = +p.height||60;
  let change;
  if (!won && (r.reason==='over'||r.reason==='xtreme')) change = h>55 ? '的 Ratchet 换成矮一点的 55 高度' : (tip!=='ball' ? '换成圆轴' : '的外圈配重调高一点');
  else if (!won) change = tip==='flat'||tip==='rush' ? '换成尖轴' : ring<80 ? '的外圈配重调高一点' : '换成圆轴';
  else change = tip==='needle' ? '换成平轴' : tip==='flat'||tip==='rush' ? '换成圆轴' : ring>50 ? '的外圈配重调低一点' : '的翼片换成 4 片';
  return `只改一个地方：把${me}${change.startsWith("的")?" ":""}${change}，其他都不变，再打一次看看！`;
}
export function templateCommentary(summary={}, names=['A','B']) {
  const r = summary.result || {}, ev = (summary.events||[]).filter(e=>e.type==='collision');
  const w = r.winner===1?1:0, label = i => i===0 ? `你的 ${names[0]||'陀螺'}` : (names[1]||'对手');
  const story = [];
  if (ev[0]) story.push(`${fmtT(ev[0].time)}第一次碰撞！撞完${label(0)} ${fmtRpm(ev[0].rpm?.[0])}，${label(1)} ${fmtRpm(ev[0].rpm?.[1])}。`);
  const big = ev.slice().sort((x,y)=>(y.intensity||0)-(x.intensity||0))[0];
  if (big && big!==ev[0]) story.push(`最猛的一撞在 ${fmtT(big.time)}，相对速度 ${fmtV(big.relSpeed)}！`);
  if (ev.length>2) story.push(`整场一共撞了 ${ev.length} 次。`);
  story.push(`${fmtT(r.time)}，${label(w)} 靠 ${REASON_ZH[r.reason]||'胜利'} 拿下 ${r.points??1} 分。`);
  const cardId = r.reason==='spin'||r.reason==='judge' ? (summary.parts?.[w]?.ring>summary.parts?.[1-w]?.ring ? 'ph-inertia':'ph-energy-loss') : 'ph-momentum';
  const c = getCard(cardId);
  return {
    headline: w===0 ? `${names[0]||'你'} 胜！${REASON_ZH[r.reason]||''}` : `${names[1]||'对手'} 胜！${REASON_ZH[r.reason]||''}`,
    story: story.slice(0,4),
    science: {cardId, title:c.title, body:c.body + '（在这个模型里）', layer:c.layer},
    tryNext: suggestTryNext(summary, names),
    fallback: true,
  };
}

// ── Free question ──
export function templateAsk(question='') {
  const cards = relevantCards(question, 2);
  const c = cards[0] || getCard('bx-three-parts');
  return {answer: `${c.title}：${c.body}`, cards: (cards.length?cards:[c]).map(({id,title,body,layer})=>({id,title,body,layer})), fallback:true};
}

export {CARDS};
