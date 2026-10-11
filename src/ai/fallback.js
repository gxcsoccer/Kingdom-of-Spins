// Pure, deterministic helpers shared by the worker (worker/ai.js) and the browser client.
// Used for validation/repair of model output and as the template fallback when the model fails.
import {specFromBey, STYLES} from '../physics/model.js';
import {CARDS, getCard, relevantCards} from '../knowledge/cards.js';

export const STYLE_ZH = {attack:'攻击型', defense:'防御型', stamina:'持久型', balance:'平衡型'};
const HEX = /^#[0-9a-f]{6}$/i;   // colors must be #rrggbb
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

// ── Look (appearance only — never changes physics) ──
export const LOOK_ENUMS = {
  shape:['blade','claw','fang','wing','flame','shield'], finish:['toon','metal','crystal','neon'],
  emblem:['dragon','wolf','eagle','shark','tiger','phoenix','lightning','flame','star','wave','mountain','letter'],
  pattern:['none','stripes','flames','bolts','dots'],
};
const STYLE_LOOK = {attack:{shape:'blade',finish:'metal',emblem:'dragon',pattern:'flames'}, defense:{shape:'shield',finish:'metal',emblem:'mountain',pattern:'stripes'},
  stamina:{shape:'wing',finish:'crystal',emblem:'wave',pattern:'dots'}, balance:{shape:'fang',finish:'toon',emblem:'star',pattern:'bolts'}};
export function sanitizeLook(raw, fallback) {
  const f = fallback || STYLE_LOOK.balance, r = raw && typeof raw==='object' ? raw : {};
  const pick = k => LOOK_ENUMS[k].includes(r[k]) ? r[k] : f[k];
  return {shape:pick('shape'), finish:pick('finish'), emblem:pick('emblem'), pattern:pick('pattern')};
}
// Kid's words → appearance hints. Colors are "first mentioned = primary".
const COLOR_WORDS = [['黑','#16161a'],['红','#e8202a'],['蓝','#2f7bff'],['白','#f5f7fa'],['金','#f2b632'],['银','#c9ced6'],['紫','#8a3cff'],['绿','#14c9a5'],['橙','#ff7a1a'],['粉','#ff5bd0'],['黄','#ffd400'],['青','#16c4d9'],['灰','#7d8794']];
const LOOK_WORDS = {
  shape:[['爪','claw'],['獠牙','fang'],['牙','fang'],['翅膀','wing'],['翼','wing'],['羽','wing'],['火焰','flame'],['盾','shield'],['刀','blade'],['剑','blade'],['刃','blade']],
  finish:[['金属','metal'],['钢','metal'],['铁','metal'],['水晶','crystal'],['冰','crystal'],['钻石','crystal'],['宝石','crystal'],['霓虹','neon'],['发光','neon'],['荧光','neon'],['夜光','neon']],
  emblem:[['凤凰','phoenix'],['龙','dragon'],['狼','wolf'],['鹰','eagle'],['鲨','shark'],['虎','tiger'],['闪电','lightning'],['雷','lightning'],['火','flame'],['星','star'],['浪','wave'],['海','wave'],['水','wave'],['山','mountain'],['字母','letter']],
  pattern:[['条纹','stripes'],['火焰纹','flames'],['火焰花纹','flames'],['闪电纹','bolts'],['闪电花纹','bolts'],['闪电','bolts'],['波点','dots'],['圆点','dots'],['点点','dots']],
};
// "叫雷龙小勇士" / "起名：雷龙小勇士" / "名字是…" → the kid's own Chinese nickname.
export function kidName(text='') {
  const m = /(?:起名(?:叫|为|是)?|名字(?:叫|是)?|就叫|叫它|叫做|叫)[：:\s「“"]*([\u4e00-\u9fa5A-Za-z0-9]{2,8})/.exec(String(text));
  return m ? m[1].replace(/[的吧啊呀吗]$/,'') : '';
}
export function wishLook(text='') {
  let t = String(text); const out = {}, notes = [];
  // Order matters: finishes first, and a matched word is blanked so 「水晶」 doesn't also read as 「水」 (wave).
  for (const k of ['finish','pattern','shape','emblem']) for (const [w, v] of LOOK_WORDS[k]) if (t.includes(w)) { out[k] = v; notes.push(`「${w}」`); if (k==='finish') t = t.split(w).join('□'); break; }
  if (/金属/.test(String(text)) && !/金色/.test(String(text))) t = t.split('金').join('□');
  if (out.emblem==='phoenix' && !out.shape) out.shape = 'wing';
  if (out.emblem==='dragon' && !out.shape && /爪/.test(t)) out.shape = 'claw';
  const colors = COLOR_WORDS.filter(([w])=>t.includes(w)).map(([w,h])=>({w,h})).sort((x,y)=>t.indexOf(x.w)-t.indexOf(y.w));
  if (colors.length) notes.unshift(`「${colors.map(c=>c.w).join('')}」配色`);
  const wings = /(两|二|2)\s*片/.test(t) ? 2 : /(三|3)\s*片/.test(t) ? 3 : /(四|4)\s*片/.test(t) ? 4 : null;
  return {look: out, colors: colors.map(c=>c.h), colorWords: colors.map(c=>c.w), wings, notes};
}
const SHIFT = (arr, v, k) => arr[(arr.indexOf(v) + k) % arr.length];
// Make the 3 candidates visibly different: at least 2 of {shape, emblem, primary color} differ pairwise.
export function diversifyLooks(cands) {
  const seen = [];
  cands.forEach((c, i) => {
    for (let guard=0; guard<6; guard++) {
      const clash = seen.find(o => [o.look.shape===c.look.shape, o.look.emblem===c.look.emblem, o.colors.primary.toLowerCase()===c.colors.primary.toLowerCase()].filter(Boolean).length >= 2);
      if (!clash) break;
      if (clash.look.shape===c.look.shape) c.look = {...c.look, shape: SHIFT(LOOK_ENUMS.shape, c.look.shape, 1+i)};
      else c.look = {...c.look, emblem: SHIFT(LOOK_ENUMS.emblem.slice(0,11), c.look.emblem==='letter'?'star':c.look.emblem, 2+i)};
      if (guard>=2) c.colors = {...c.colors, primary: COLOR_WORDS[(COLOR_WORDS.findIndex(([,h])=>h===c.colors.primary)+3+i+COLOR_WORDS.length)%COLOR_WORDS.length][1]};
    }
    seen.push(c);
  });
  return cands;
}
const EMBLEM_ZH = {dragon:'龙',wolf:'狼',eagle:'鹰',shark:'鲨',tiger:'虎',phoenix:'凤凰',lightning:'雷霆',flame:'烈焰',star:'星辰',wave:'怒涛',mountain:'山岳',letter:'印记'};
const MOVE_TAIL = {attack:['爆裂斩','冲锋破'],defense:['铁壁阵','不动盾'],stamina:['永旋舞','回旋风'],balance:['疾风击','流转刃']};
export const specialMoveFor = (look, style, i=0) => {
  const e = EMBLEM_ZH[look?.emblem] || '旋风', t = (MOVE_TAIL[style]||MOVE_TAIL.balance)[i%2];
  return {name:`${e}${t}`.slice(0,8), shout:`${e}之力——${t}！`.slice(0,16)};
};

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
    look: sanitizeLook(raw.look, STYLE_LOOK[blade.style]),
    lookNote: str(raw.lookNote, 60, ''),
    specialMove: raw.specialMove && typeof raw.specialMove==='object' && raw.specialMove.name
      ? {name:str(raw.specialMove.name,10,'必杀旋风'), shout:str(raw.specialMove.shout,20,'旋转吧——！')} : null,
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
  const base = fusionName(a,b), wl = wishLook(wish);
  const palettes = [
    {primary:wl.colors[0]||a.colors?.primary, secondary:wl.colors[1]||b.colors?.secondary, accent:wl.colors[2]||b.colors?.accent},
    {primary:wl.colors[1]||b.colors?.primary, secondary:wl.colors[0]||a.colors?.secondary, accent:a.colors?.accent},
    {primary:a.colors?.accent, secondary:'#ffffff', accent:wl.colors[0]||b.colors?.primary},
  ];
  const cands = order.map((style,i) => {
    const t = TARGET[style], mix = (k)=>avg(k)*.4 + t[k]*.6;
    // Candidate 1 follows the kid's words fully; the others keep some of it and vary the rest.
    const look = i===0 ? {...STYLE_LOOK[style], ...wl.look} : i===1 ? {...STYLE_LOOK[style], finish: wl.look.finish||STYLE_LOOK[style].finish, pattern: wl.look.pattern||STYLE_LOOK[style].pattern} : {...STYLE_LOOK[style], emblem: wl.look.emblem||STYLE_LOOK[style].emblem};
    const c = sanitizeCandidate({
      name: i===0 ? base : `${base} ${['','II','X'][i]}`.trim(), zh: VERSION_ZH[style],
      style, wings: i===0 && wl.wings ? wl.wings : t.wings, reach: mix('reach'), ring: mix('ring'), mass: mix('mass'),
      colors: palettes[i], look,
      lookNote: i===0 && wl.notes.length ? `你说了${wl.notes.slice(0,4).join('、')} → 都画进了外观` : '',
      why: t.why, tradeoff: t.tradeoff, cards: t.cards,
      lore: `${a.name||'A'} 和 ${b.name||'B'} 的刃合体，走${STYLE_ZH[style]}路线。`,
    }, parents, keepParent, 'template');
    c.specialMove = specialMoveFor(c.look, style, i);
    return c;
  });
  const nm = kidName(wish); if (nm) cands.forEach(c=>{ c.zh = nm; });
  return diversifyLooks(cands);
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

// ── Key moments ── (moments are computed from real battle data by the game; we only word them)
const BIT_LABEL = {needle:'尖轴', ball:'圆轴', flat:'平轴', rush:'冲刺轴'};
const MOMENT_CARD = {'first-hit':'ph-momentum', 'big-hit':'ph-energy-convert', 'spin-drop':'ph-tilt-fall', 'dash':'bx-xdash', 'finish':'bx-finish-points'};
export const momentCard = m => m.kind==='finish' && (m.data?.reason==='spin'||m.data?.reason==='judge') ? 'ph-energy-loss' : (MOMENT_CARD[m.kind] || 'ph-momentum');
const rpmDrop = (d={}, i) => d.rpmBefore && d.rpmAfter ? Math.abs(d.rpmBefore[i]) - Math.abs(d.rpmAfter[i]) : null;
const fmtDrop = n => `约 ${(Math.round(Math.abs(n)/100)*100).toLocaleString('en-US')} 转`;
// Per-kind anime announcer lines and "你猜？" quizzes. Physics matches our model: drag + tip friction
// slowly drain spin, collisions convert spin into motion/wobble, the rail never adds energy.
const DJ = {
  'first-hit': w => `第一次交锋——火花四溅！`,
  'big-hit': w => `出现了！全场最猛的一击——！`,
  'spin-drop': w => `${w} 的转速在暴跌——撑住啊！`,
  'dash': w => `${w} 咬住齿轨——X 冲刺！！`,
  'finish': w => `胜负已分——${w} 站到了最后！`,
};
const QUIZ = {
  'first-hit': {q:'撞完以后，谁更不容易被弹开？', options:['更重、刃更靠外的那只','更轻、更小的那只'], answer:0,
    reveal:'动量 = 质量 × 速度。越重的陀螺，同样一撞速度变化越小，越难被弹开。', analogy:'保龄球撞球瓶：重的球继续往前，瓶子飞走了。'},
  'big-hit': {q:'猛撞之后，转速为什么一下掉这么多？', options:['撞击给陀螺加了速','转动的能量变成了弹开和晃动'], answer:1,
    reveal:'能量不会凭空消失：一部分转动变成了弹开的跑动和晃动，还有声音和热。', analogy:'碰碰车撞完，两辆车都弹开、变慢了。'},
  'spin-drop': {q:'转速变低后，陀螺为什么开始晃？', options:['角动量变小，扛不住重力','陀螺累了想休息'], answer:0,
    reveal:'转得快时角动量大，重力推不倒它；转慢了，角动量不够，轴就越晃越歪。', analogy:'自行车骑得快很稳，骑得太慢就开始左右晃。'},
  'dash': {q:'冲刺的速度是从哪来的？', options:['场地推了它一把，多给了能量','它把自己的转动变成了往前冲'], answer:1,
    reveal:'齿轮咬住齿轨，把转动变成前进。总能量没有增加，所以冲完转速会掉一些。', analogy:'轮子在地上一转，自行车就往前走。'},
  'finish-spin': {q:'为什么它最后先停了下来？', options:['摩擦和碰撞一点点吃掉了转速','陀螺规定只能转 10 秒'], answer:0,
    reveal:'轴尖摩擦、空气阻力和每次碰撞都在消耗转动能量，谁的能量先用完谁就倒下。', analogy:'桌上转硬币，越转越慢，最后“啪”地倒下。'},
  'finish-over': {q:'为什么会被撞出场外？', options:['场地把它吸了出去','被撞时速度一下变得太大'], answer:1,
    reveal:'被猛撞时得到很大的冲量，速度一下变大，就冲过了墙边的缺口。', analogy:'保龄球把球瓶撞得飞出了球道。'},
};
export function templateQuiz(m={}) {
  const key = m.kind==='finish' ? ((m.data?.reason==='over'||m.data?.reason==='xtreme') ? 'finish-over' : 'finish-spin') : m.kind;
  const concept = key==='finish-over' ? 'ph-momentum' : momentCard(m);
  const q = pickFromBank(concept, []);
  return q ? {...shuffled(q), cardId:concept} : {...(QUIZ[key] || QUIZ['big-hit'])};
}
export function sanitizeQuiz(raw, m) {
  const t = templateQuiz(m);
  if (!raw || typeof raw!=='object') return t;
  const options = Array.isArray(raw.options) ? raw.options.map(o=>String(o).trim().slice(0,18)).filter(Boolean) : [];
  if (options.length!==2 || ![0,1].includes(+raw.answer) || !raw.q || !raw.reveal) return t;
  return {q:String(raw.q).slice(0,30), options, answer:+raw.answer, reveal:String(raw.reveal).slice(0,70), analogy:String(raw.analogy||t.analogy).slice(0,44)};
}
export const templateDJ = (m={}, names=['A','B']) => {
  const who = m.kind==='finish' ? (m.data?.winner===1 ? (names[1]||'对手') : (names[0]||'你')) : (m.body===1 ? (names[1]||'对手') : (names[0]||'你'));
  return (DJ[m.kind] || DJ['big-hit'])(who);
};
export function templateMoment(m={}, names=['A','B']) {
  const who = i => i===0 ? `你的 ${names[0]||'陀螺'}` : (names[1]||'对手');
  const d = m.data || {}, t = fmtT(m.time);
  const drops = [0,1].map(i=>rpmDrop(d,i));
  const bigger = drops[0]!=null ? (drops[0]>=drops[1]?0:1) : null;
  let title, explain;
  switch (m.kind) {
    case 'first-hit':
      title = '第一次交锋！';
      explain = `${t}两只陀螺第一次相撞${d.relSpeed!=null?`，相对速度 ${fmtV(d.relSpeed)}`:''}。在这个模型里，谁更重、刃更靠外，谁就更不容易被弹开。`;
      break;
    case 'big-hit':
      title = '全场最猛一撞！';
      explain = `${t}${d.relSpeed!=null?`相对速度 ${fmtV(d.relSpeed)} 的猛撞`:'一记猛撞'}${bigger!=null&&drops[bigger]>50?`，${who(bigger)} 的转速一下掉了${fmtDrop(drops[bigger])}`:''}——转动的能量变成了弹开和晃动。`;
      break;
    case 'spin-drop': {
      const b = m.body ?? 0, drop = d.drop ?? drops[b];
      title = '转速大跳水';
      const win = d.window ? `${d.window} 秒内` : '很短时间内';
      explain = d.cause==='collision'
        ? `${t}${win}${who(b)} 的转速掉了${fmtDrop(drop)}——${d.hitTime!=null?`${fmtT(d.hitTime)}那一撞`:'一次碰撞'}把转动的能量变成了弹开和晃动。`
        : `${t}${win}${who(b)} 的转速掉了${fmtDrop(drop)}，这段时间没有碰撞——是轴尖和地面的摩擦在慢慢“吃掉”转速。转速越低越容易晃。`;
      break;
    }
    case 'dash':
      title = 'X 冲刺！';
      explain = `${t}${who(m.body ?? 0)} 的 Bit 咬上边缘齿轨，把一部分转动变成了向前冲的速度！冲刺很猛，但转速也会被消耗。`;
      break;
    case 'finish': {
      const w = d.winner ?? 0, r = d.reason;
      title = {xtreme:'Xtreme 终结！', over:'撞出场外！', spin:'最后的站立者', judge:'时间到！'}[r] || '决胜时刻';
      explain = r==='over'||r==='xtreme'
        ? `${t}${who(1-w)} 被撞出了场地，${who(w)} 拿下 ${r==='xtreme'?3:2} 分！在这个模型里，被撞时速度变化越大的一方越容易出局。`
        : `${t}${who(1-w)} 转不动倒下了，${who(w)} 还在转！在这个模型里，摩擦和碰撞一点点吃掉转速，谁先转不动谁就输。`;
      break;
    }
    default:
      title = '关键时刻'; explain = `${t}发生了关键变化。`;
  }
  return {id:m.id, title, explain, cardId: momentCard(m), dj: templateDJ(m, names), quiz: templateQuiz(m)};
}
export function designTakeaway(summary={}, names=['A','B']) {
  const p = summary.parts?.[0] || {}, r = summary.result || {}, me = `你的 ${names[0]||'陀螺'}`;
  const won = r.winner===0, bit = BIT_LABEL[p.tip] || 'Bit';
  if (r.reason==='over'||r.reason==='xtreme') return won ? `${me} 把对手撞出场外，说明它的刃和重量在碰撞中占了上风（在这个模型里）。` : `${me} 被撞出去了：试试更重的刃或更矮的 Ratchet，让它更难被撞飞。`;
  if (won) return `${me} 熬到了最后：外圈配重 ${p.ring??'?'}% 加 ${bit}，让转速掉得更慢（在这个模型里）。`;
  return `${me} 先转不动了：${bit}的摩擦和碰撞消耗了转速，试试外圈配重更高或更尖的轴。`;
}
export function templateMoments(summary={}, moments=[], names=['A','B']) {
  const r = summary.result || {}, w = r.winner===1?1:0;
  return {
    headline: (w===0 ? `${names[0]||'你'} 赢啦！` : `${names[1]||'对手'} 胜出！`).slice(0,14),
    moments: (moments||[]).map(m=>templateMoment(m, names)),
    takeaway: designTakeaway(summary, names),
    fallback: true,
  };
}

// ── Controlled experiment ── (A = original setting, B = changed variable; index 0 = player)
// Same rule as src/game/experiment.js: wins first, then 3-second rpm differing by >15%.
export function experimentVerdict(stats={}) {
  const A = stats.A || {}, B = stats.B || {};
  if ((B.wins??0) !== (A.wins??0)) return (B.wins??0) > (A.wins??0) ? 'B更好' : 'A更好';
  const ra = +A.avgRpm3||0, rb = +B.avgRpm3||0;
  if (Math.abs(rb-ra) > Math.max(ra,1)*.15) return rb > ra ? 'B更好' : 'A更好';
  return '差不多';
}
// Which measurement decided the verdict, with the numbers — every text must agree with this.
export function decisiveMetric(stats={}, verdict) {
  const A = stats.A || {}, B = stats.B || {};
  if ((B.wins??0) !== (A.wins??0)) return {key:'wins', text:`胜场：改装后 ${B.wins??0}/${B.trials??3} 次，原来 ${A.wins??0}/${A.trials??3} 次`, short:`改装后赢 ${B.wins??0} 次、原来赢 ${A.wins??0} 次`};
  if (verdict!=='差不多') return {key:'rpm3', text:`胜场一样多（都是 ${A.wins??0} 次），比第 3 秒转速：改装后${fmtRpm(B.avgRpm3)}，原来${fmtRpm(A.avgRpm3)}`, short:`第 3 秒转速改装后${fmtRpm(B.avgRpm3)}、原来${fmtRpm(A.avgRpm3)}`};
  return {key:'same', text:`胜场一样多（都是 ${A.wins??0} 次），第 3 秒转速也接近（${fmtRpm(B.avgRpm3)} vs ${fmtRpm(A.avgRpm3)}）`, short:'胜场和转速都差不多'};
}
const VERDICTS = ['B更好','A更好','差不多'];
export const predictionOk = (prediction, verdict) => (prediction==='more'&&verdict==='B更好')||(prediction==='less'&&verdict==='A更好')||(prediction==='same'&&verdict==='差不多');
export function predictionFeedbackText(prediction, verdict) {
  const said = {more:'改了会更好', less:'改了会更差', same:'差不多'}[prediction];
  const got = {B更好:'改了以后更好', A更好:'原来的更好', 差不多:'差不多'}[verdict];
  if (!said) return '下次先猜一猜，再看实验结果！';
  return predictionOk(prediction, verdict) ? `你猜「${said}」，结果真的是${got}！` : `你猜「${said}」，结果是${got}——这正是实验的意义！`;
}
// Does a sentence claim the opposite of the verdict?
export function contradictsVerdict(text='', verdict) {
  const t = String(text);
  const saysB = /改(装|了|成)[^，。；]{0,12}(更好|更强|赢|胜|更久|更持久)|原(来|版)[^，。；]{0,10}(更差|不如|输)/.test(t);
  const saysA = /原(来|版)[^，。；]{0,12}(更好|更强|赢|胜|更久|更持久)|改(装|了|成)[^，。；]{0,10}(更差|变差|不如|更弱|输)/.test(t);
  const saysSame = /差不多|几乎一样|没(什么|有)区别|一样好/.test(t);
  if (verdict==='B更好') return saysA || (saysSame && !saysB);
  if (verdict==='A更好') return saysB || (saysSame && !saysA);
  return (saysA || saysB) && !saysSame;
}
const VAR_CARD = [[/bit|tip|轴/i,'ph-friction-area'],[/ring|配重|惯量/i,'ph-inertia'],[/height|ratchet|高度/i,'ph-com-height'],[/wing|翼/i,'ph-wing-contact'],[/rpm|launch|发射|转速/i,'ph-launch-rpm'],[/mass|重/i,'ph-mass-tradeoff'],[/style|type|类型/i,'bx-types']];
export const variableCard = (variable={}) => (VAR_CARD.find(([re])=>re.test(`${variable.key||''} ${variable.label||''}`))||[0,'sm-control'])[1];
const VAR_WHY = {
  'ph-friction-area': '轴尖碰地的面积和摩擦变了：摩擦大跑得猛但转速掉得快，摩擦小更省转速。',
  'ph-inertia': '外圈配重改变了转动惯量：重量越靠外，越难被弄停，也越难被撞得改变转动。',
  'ph-com-height': 'Ratchet 高度改变了重心和刃的碰撞高度：重心低更稳，高了更容易被掀歪。',
  'ph-wing-contact': '翼片数改变了刃的形状：翼片少撞击更集中，翼片多更圆滑，碰撞方式就不一样了。',
  'ph-launch-rpm': '发射转速改变了一开始的角动量：转得越快越稳，也有更多能量可以消耗。',
  'ph-mass-tradeoff': '重量改变了动量：越重越难被撞飞，但同样的发射力转速会更低。',
  'bx-types': '类型改变了刃的形状和配重，碰撞和持久的取舍就跟着变了。',
  'sm-control': '只改了一个变量，所以结果的差别就来自这个变量。',
};
// Concrete physics facts about the changed variable, so the model's "why" has the right direction.
import {TIPS as _TIPS} from '../physics/model.js';
const BIT_KEYS = {needle:['needle','尖'], ball:['ball','圆'], flat:['flat','平'], rush:['rush','冲刺','橡胶']};
const bitOf = v => Object.entries(BIT_KEYS).find(([,ks])=>ks.some(k=>String(v).toLowerCase().includes(k)))?.[0];
export function variableFacts(variable={}) {
  const card = variableCard(variable), {from, to} = variable;
  if (card==='ph-friction-area') {
    const a = bitOf(from), b = bitOf(to);
    if (a && b) {
      const A = _TIPS[a], B = _TIPS[b], d = (x,y)=>x>y?'更大':x<y?'更小':'一样';
      return `轴尖从「${from}」到「${to}」：碰地半径 ${(A.radius*1000).toFixed(1)}→${(B.radius*1000).toFixed(1)} mm（${d(B.radius,A.radius)}），转动摩擦的力臂 ${(A.spinRadius*1000).toFixed(1)}→${(B.spinRadius*1000).toFixed(1)} mm（${d(B.spinRadius,A.spinRadius)}，所以转速消耗${d(B.spinRadius,A.spinRadius)==='更小'?'更慢':d(B.spinRadius,A.spinRadius)==='更大'?'更快':'差不多'}），接触面${d(B.radius,A.radius)==='更大'?'更大、更爱满场跑':'更小、更爱待在原地'}。`;
    }
  }
  const num = v => parseFloat(String(v).replace(/[^\d.\-]/g,''));
  const up = num(to) > num(from), dir = Number.isFinite(num(to)) && Number.isFinite(num(from)) ? (up?'变大':'变小') : '改变';
  if (card==='ph-inertia') return `外圈配重${dir}：重量${up?'更靠外':'更靠内'}，转动惯量${up?'更大':'更小'}，${up?'更难被弄停、更持久':'更容易被改变转动'}。`;
  if (card==='ph-com-height') return `Ratchet 高度${dir}：重心${up?'更高，更容易被撞歪':'更低，更稳'}，刃的碰撞高度也${up?'变高':'变低'}。`;
  if (card==='ph-wing-contact') return `翼片数${dir}：${up?'外形更圆，撞击更像擦过去':'缺口更大，撞击更集中、更猛'}。`;
  if (card==='ph-launch-rpm') return `发射转速${dir}：角动量和转动能量${up?'更多，更稳更持久':'更少，更早转不动'}。`;
  if (card==='ph-mass-tradeoff') return `重量${dir}：${up?'更难被撞飞，但同样发射力转速更低':'更轻更容易被撞飞'}。`;
  return VAR_WHY[card] || '';
}
// Make sure the player's bey is always called "你的 X" in model prose.
export function ownName(text='', name='', other='') {
  if (!name) return text;
  const esc = v => v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Protect the opponent's name when it contains ours (e.g. "Thunder Dragoon" vs "Dragoon").
  let t = String(text); const hold = '\u0001';
  if (other && other!==name && other.includes(name)) t = t.split(other).join(hold);
  t = t.replace(new RegExp(`(^|[^的A-Za-z])\\s*(${esc(name)})(?![A-Za-z])`,'g'), (m,pre,n)=>`${pre}你的 ${n}`).replace(/你的\s+你的/g,'你的');
  return t.split(hold).join(other);
}
const NEXT_VARS = [['ph-friction-area','换一种 Bit（轴尖）'],['ph-inertia','调外圈配重'],['ph-com-height','换 Ratchet 高度'],['ph-wing-contact','改翼片数量'],['ph-launch-rpm','改发射转速']];
// ── Guided "原理讲解": textbook expectation vs THIS data (consistent with the code verdict) + a real-life analogy ──
const TIP_ARM = {needle:.35, ball:.9, flat:2, rush:2.6}, TIP_ZH = {needle:'尖轴', ball:'圆轴', flat:'平轴', rush:'冲刺轴'};
const LIFE = {
  'ph-friction-area':'冰鞋在冰上滑得又久又远，运动鞋抓地强、能猛冲但停得快。',
  'ph-inertia':'花样滑冰张开手臂转得慢、收紧手臂转得快。',
  'ph-com-height':'不倒翁重心低，推一下又站回来；高高的积木塔一碰就倒。',
  'ph-wing-contact':'拳头集中一点打出去更有力，手掌拍出去力量更分散。',
  'ph-launch-rpm':'自行车骑得越快越稳，慢下来就开始晃。',
  'ph-mass-tradeoff':'保龄球很重，撞瓶后还继续往前滚。',
  'bx-types':'足球队里有前锋也有后卫，各有各的长处。',
  'sm-control':'比较两种肥料时，只换肥料，阳光和水都要一样。',
};
// +1: textbook expects the changed bey (B) to keep spin better / be harder to beat; −1: worse; 0: unclear.
export function textbookExpectation(variable={}, physics={}) {
  const card = variableCard(variable), p = physics || {};
  const d = (a, b) => (Number.isFinite(+a) && Number.isFinite(+b) && +a !== +b) ? Math.sign(+b - +a) : 0;
  if (card==='ph-friction-area' && TIP_ARM[p.tipA] && TIP_ARM[p.tipB]) { const dir = -Math.sign(TIP_ARM[p.tipB]-TIP_ARM[p.tipA]);
    return {dir, text:`课本预期：${TIP_ZH[p.tipA]}换成${TIP_ZH[p.tipB]}，碰地的摩擦力臂${dir>0?'变短':'变长'}，转速应该掉得${dir>0?'更慢、更持久':'更快，但更会跑、撞得更猛'}。`}; }
  if (card==='ph-inertia' || (d(p.IzA,p.IzB) && card==='sm-control')) { const dir = d(p.IzA, p.IzB);
    return {dir, text: dir ? `课本预期：转动惯量${dir>0?'变大':'变小'}（${(+p.IzA).toFixed?.(1)??p.IzA} → ${(+p.IzB).toFixed?.(1)??p.IzB}），陀螺应该${dir>0?'更难被弄停、更持久':'更容易掉转速'}。` : '课本预期：转动惯量几乎没变，差别应该不大。'}; }
  if (card==='ph-com-height') { const dir = -d(p.heightA, p.heightB);
    return {dir, text:`课本预期：Ratchet ${dir>0?'变矮':'变高'}，重心${dir>0?'更低、更稳':'更高、更容易被撞歪'}。`}; }
  if (card==='ph-mass-tradeoff') { const dir = d(p.massA, p.massB);
    return {dir, text:`课本预期：陀螺${dir>0?'变重':'变轻'}，被撞时速度变化${dir>0?'更小、更难被撞飞':'更大、更容易被撞飞'}。`}; }
  if (card==='ph-launch-rpm') { const dir = d(variable.from, variable.to) || 1;
    return {dir, text:`课本预期：发射转速${dir>0?'更高':'更低'}，角动量${dir>0?'更大，更稳更持久':'更小，更早转不动'}。`}; }
  return {dir:0, text:`课本预期：${VAR_WHY[card] || '只改一个变量，看看结果会不会变。'}`};
}
const COMPETING = {
  'ph-friction-area':'抓地强的轴尖虽然掉转快，但跑得猛、撞得狠，有时能先把对手撞出去',
  'ph-inertia':'改配重时重量和刃的形状也一起变了，碰撞的方式会跟着变',
  'ph-com-height':'刃的碰撞高度也变了，撞到对手的位置不一样',
  'ph-mass-tradeoff':'更重的陀螺同样发射力转速会更低',
  'ph-wing-contact':'翼片变了以后，碰撞的位置和角度都会改变',
  'ph-launch-rpm':'转得快也跑得猛，更容易撞墙掉转',
};
export function experimentSteps({variable={}, stats={}, physics={}}, verdict) {
  const card = variableCard(variable), exp = textbookExpectation(variable, physics), dm = decisiveMetric(stats, verdict);
  const got = verdict==='B更好' ? 1 : verdict==='A更好' ? -1 : 0;
  let why;
  if (exp.dir && got===exp.dir) why = `${dm.short}——和课本预期一致。在这个模型里，${VAR_WHY[card] || '这个变量确实起了作用。'}`;
  else if (!got) why = `${dm.short}。课本说应该有差别，但差别可能被碰撞的偶然性盖住了，建议多比几次。`;
  else if (exp.dir) why = `${dm.short}，和课本相反！可能因为${COMPETING[card] || '碰撞位置有偶然性'}。只比了 ${(stats.A?.trials)||3} 次，建议多做几次。`;
  else why = `${dm.short}。在这个模型里，${VAR_WHY[card] || '这个变量影响了结果。'}`;
  return {expect: exp.text.slice(0,70), why: why.length>110 ? why.slice(0,109)+'…' : why, life: (LIFE[card] || LIFE['sm-control']).slice(0,44), textbookDir: exp.dir};
}

export function templateExperiment({names=['A','B'], variable={}, prediction=null, metric={}, stats={}, trials=[], verdict:given=null, physics={}}={}) {
  const verdict = VERDICTS.includes(given) ? given : experimentVerdict(stats), A = stats.A||{}, B = stats.B||{};
  const from = variable.from ?? '原来', to = variable.to ?? '新设置', label = variable.label || '这个变量';
  const dm = decisiveMetric(stats, verdict);
  const conclusion = `${dm.text}。在这个模型里，${verdict==='B更好'?`改成「${to}」更好`:verdict==='A更好'?`原来的「${from}」更好`:'两种差不多'}。`;
  const cardId = variableCard(variable);
  // Consistency across trials: did the player win in the same configurations each time?
  const bw = trials.filter(t=>t?.B?.winner===0).length, aw = trials.filter(t=>t?.A?.winner===0).length, m = trials.length;
  const consistent = m>0 && (bw===0||bw===m) && (aw===0||aw===m);
  const clear = m>0 && Math.abs(bw-aw) >= Math.ceil(m/2);
  const repeatLesson = !m ? '多做几次同样的实验，结论才可靠。'
    : consistent ? `${m} 次结果都一样，说明这个差别很稳定，不是运气。`
    : clear ? `改成「${to}」${m} 次赢 ${bw} 次，原来赢 ${aw} 次——大多数时候都这样，不只是运气。`
    : `${m} 次里结果不太一样，碰撞很敏感，要多做几次才能看清规律。`;
  const next = NEXT_VARS.find(([c])=>c!==cardId) || NEXT_VARS[0];
  const steps = experimentSteps({variable, stats, physics}, verdict);
  return {verdict, decisive:dm.key, steps, conclusion: conclusion.slice(0,100), why: VAR_WHY[cardId] || VAR_WHY['sm-control'], repeatLesson, predictionFeedback: predictionFeedbackText(prediction, verdict), cardId, nextIdea:`下次只${next[1]}，其他都不变，看看会怎样？`, fallback:true};
}

// ── AI 科学绘本 (flipbook) ── page shape shared by worker + client.
export const FLIP_STYLE = "bright Japanese anime cel-shaded illustration with bold clean ink outlines, manga screentone accents, dynamic speed lines, children's science adventure book, 4:3 frame, no text, no letters, no speech bubbles";
// Visual recipe per card for the template fallback (flux can't draw words, so only things to look at).
const FLIP_ART = {
  'ph-inertia':'a spinning top seen from above with heavy metal weights glowing on its outer ring, motion blur circles, arrows curving around the rim',
  'ph-figure-skater':'a figure skater spinning on ice pulling arms in close, swirl lines around her, a spinning top beside her mirroring the pose',
  'ph-friction-area':'three spinning tops side by side, one with a sharp needle tip, one with a round ball tip, one with a flat tip, close-up of the tips touching the floor with small friction sparks',
  'ph-needle':'close-up of a sharp needle tip of a spinning top touching the floor at a single point, calm circular motion lines',
  'ph-flat':'a spinning top with a flat tip racing across a bowl-shaped arena leaving a curved trail, speed lines',
  'ph-momentum':'two spinning tops colliding head on, the heavier one pushing the lighter one away, impact star burst',
  'ph-energy-convert':'two spinning tops crashing with bright sparks, wobble lines and sound wave rings flying out',
  'ph-gyro-stability':'a fast spinning top standing upright while a giant hand of gravity tries to push it, the top only circles slowly',
  'ph-precession':'a tilted spinning top whose axis traces a slow circle, dotted circular path above it',
  'ph-tilt-fall':'a slowing spinning top wobbling and leaning more and more, sequence of three poses from upright to falling',
  'ph-com-height':'two spinning tops, one tall and one short, a dot marking the center of gravity in each, the tall one tipping when bumped',
  'bx-xdash':'a spinning top whose gear tip bites into a toothed rail on the arena edge and dashes forward with speed lines',
  'bx-three-parts':'an exploded view of a battle spinning top: blade on top, ratchet in the middle, bit tip at the bottom, floating apart',
  'sm-control':'a young scientist at a lab bench comparing two identical spinning tops, only one part different, magnifying glass',
};
const FLIP_TAGS_ART = t => /碰撞|撞/.test(t) ? FLIP_ART['ph-momentum'] : /摩擦|bit|轴/.test(t) ? FLIP_ART['ph-friction-area'] : FLIP_ART['ph-inertia'];
const FLIP_HOTSPOTS = [
  {x:.5, y:.78, label:'轴尖', hint:'tip touching the floor — friction & contact area'},
  {x:.78, y:.4, label:'外圈', hint:'outer ring — moment of inertia'},
  {x:.5, y:.42, label:'中心', hint:'center axis — angular momentum & stability'},
  {x:.25, y:.3, label:'火花', hint:'sparks / impact — energy conversion'},
];
const pageId = s => 'pg-' + shortHash(String(s));
const num01 = (v, d) => { const n = +v; return Number.isFinite(n) ? Math.max(.04, Math.min(.96, n)) : d; };
export function sanitizePage(raw={}, fallbackCardId='ph-inertia') {
  const card = getCard(raw.cardId) || getCard(fallbackCardId) || getCard('ph-inertia');
  const panels = (Array.isArray(raw.panels) ? raw.panels : []).slice(0,4).map((p,i)=>({
    text: clean(String(p?.text||'')).slice(0,56), kind: ['caption','bubble','label'].includes(p?.kind) ? p.kind : (i===0?'caption':'bubble'),
    x: num01(p?.x, [.06,.62,.08,.6][i]), y: num01(p?.y, [.06,.12,.74,.78][i]),
  })).filter(p=>p.text);
  if (!panels.length) panels.push({text:card.body.slice(0,50), kind:'caption', x:.06, y:.06});
  const hotspots = (Array.isArray(raw.hotspots) ? raw.hotspots : []).slice(0,4).map((h,i)=>({
    x: num01(h?.x, FLIP_HOTSPOTS[i%4].x), y: num01(h?.y, FLIP_HOTSPOTS[i%4].y),
    label: clean(String(h?.label||FLIP_HOTSPOTS[i%4].label)).slice(0,6), hint: String(h?.hint||'').slice(0,160),
  }));
  while (hotspots.length < 3) hotspots.push({...FLIP_HOTSPOTS[hotspots.length]});
  // Keep caption boxes (≈40%×16% of the frame) off the tappable hotspots: move overlapping ones to a free corner.
  const covers = (p, h) => h.x >= p.x-.03 && h.x <= p.x+.43 && h.y >= p.y-.03 && h.y <= p.y+.19;
  const corners = [[.04,.04],[.56,.04],[.04,.78],[.56,.78],[.04,.42],[.56,.42]];
  for (const p of panels) {
    if (!hotspots.some(h=>covers(p,h))) continue;
    const spot = corners.find(([x,y])=>{ const q={x,y}; return !hotspots.some(h=>covers(q,h)) && !panels.some(o=>o!==p && Math.abs(o.x-x)<.3 && Math.abs(o.y-y)<.15); });
    if (spot) { p.x = spot[0]; p.y = spot[1]; }
  }
  // Strip anything that would make flux draw words.
  let imagePrompt = String(raw.imagePrompt||'').replace(/["“”「」]/g,'').replace(/\b(?:no|without)\s+(?:any\s+)?(?:text|letters?|words?|labels?|captions?|numbers?|speech bubbles?)\b\s*,?/gi,'').replace(/\b(text|caption|label|title|letters?|words?|speech bubbles?)\b[^,.]*/gi,'').replace(/(,\s*)+/g,', ').replace(/^[,\s]+|[,\s]+$/g,'').slice(0,700).trim();
  if (imagePrompt.length < 20) imagePrompt = FLIP_ART[card.id] || FLIP_TAGS_ART(card.tags.join(' '));
  const title = clean(String(raw.title||card.title)).slice(0,14);
  return {id: pageId(title + imagePrompt), title, panels, imagePrompt, hotspots, cardId: card.id, layer: card.layer};
}
// Deterministic page for a card (used when Claude is unavailable).
export function templateFlipPage({cardId, topic='', from=null}={}) {
  const card = getCard(cardId) || relevantCards(topic, 1)[0] || getCard('ph-inertia');
  const parts = card.body.split(/(?<=[。！？])/).filter(Boolean);
  return sanitizePage({
    title: card.title, cardId: card.id, imagePrompt: FLIP_ART[card.id] || FLIP_TAGS_ART(card.tags.join(' ')),
    panels: [
      {text: from ? `你点了「${from}」！` + (parts[0]||'') : (parts[0]||card.body), kind:'caption', x:.05, y:.05},
      ...(parts[1] ? [{text: parts.slice(1).join('').slice(0,50), kind:'bubble', x:.56, y:.72}] : []),
    ],
    hotspots: FLIP_HOTSPOTS.slice(0,3),
  }, card.id);
}
// Map a tapped hotspot (by its hint/label) to the next card for the template path.
export function templateFlipTap(page={}, x=.5, y=.5) {
  const hs = page.hotspots?.length ? page.hotspots : FLIP_HOTSPOTS;
  const near = hs.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
  const t = `${near.label} ${near.hint}`;
  const next = /轴尖|tip|friction|摩擦/i.test(t) ? 'ph-friction-area' : /外圈|ring|inertia|惯量/i.test(t) ? (page.cardId==='ph-inertia'?'ph-figure-skater':'ph-inertia')
    : /火花|spark|energy|能量|撞/i.test(t) ? 'ph-energy-convert' : /中心|axis|stab|角动量/i.test(t) ? (page.cardId==='ph-gyro-stability'?'ph-precession':'ph-gyro-stability') : 'ph-momentum';
  return templateFlipPage({cardId: next===page.cardId ? 'ph-energy-loss' : next, from: near.label});
}

// ── Gate quiz bank: correctness comes from the shared bank (src/knowledge/quizbank.js); the model only picks the card. ──
import {QUIZ_BANK, pickFromBank, shuffled} from '../knowledge/quizbank.js';
export const GATE_BANK = QUIZ_BANK;
// Build a validated gate from the bank; options are shuffled so the answer isn't always A.
export function bankGate(cardId, quizId, lead='', seen=[]) {
  const q0 = pickFromBank(cardId, seen); if (!q0) return null;
  const q = shuffled(q0);
  return {type:'gate', quizId: q.id, lead: String(lead||'').slice(0,40), q: q.q, options: q.options, answer: q.answer, explain: q.explain, cardId};
}

// ── Free question ──
export function templateAsk(question='') {
  const cards = relevantCards(question, 2);
  const c = cards[0] || getCard('bx-three-parts');
  return {answer: `${c.title}：${c.body}`, cards: (cards.length?cards:[c]).map(({id,title,body,layer})=>({id,title,body,layer})), fallback:true};
}

export {CARDS};
