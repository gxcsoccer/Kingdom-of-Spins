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

// ── Key moments ── (moments are computed from real battle data by the game; we only word them)
const BIT_LABEL = {needle:'尖轴', ball:'圆轴', flat:'平轴', rush:'冲刺轴'};
const MOMENT_CARD = {'first-hit':'ph-momentum', 'big-hit':'ph-energy-convert', 'spin-drop':'ph-tilt-fall', 'dash':'bx-xdash', 'finish':'bx-finish-points'};
export const momentCard = m => m.kind==='finish' && (m.data?.reason==='spin'||m.data?.reason==='judge') ? 'ph-energy-loss' : (MOMENT_CARD[m.kind] || 'ph-momentum');
const rpmDrop = (d={}, i) => d.rpmBefore && d.rpmAfter ? Math.abs(d.rpmBefore[i]) - Math.abs(d.rpmAfter[i]) : null;
const fmtDrop = n => `约 ${(Math.round(Math.abs(n)/100)*100).toLocaleString('en-US')} 转`;
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
      explain = `${t}${who(b)} 的转速${drop?`掉了${fmtDrop(drop)}`:'掉得很快'}。转速低了角动量变小，陀螺就开始晃，越晃越容易倒。`;
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
  return {id:m.id, title, explain, cardId: momentCard(m)};
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
export function experimentVerdict(stats={}) {
  const A = stats.A || {}, B = stats.B || {};
  if ((B.wins??0) !== (A.wins??0)) return (B.wins??0) > (A.wins??0) ? 'B更好' : 'A更好';
  const ta = +A.avgTime||0, tb = +B.avgTime||0, base = Math.max(ta, tb, 1e-6);
  if (Math.abs(tb-ta)/base > .15) return tb > ta ? 'B更好' : 'A更好';
  return '差不多';
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
const NEXT_VARS = [['ph-friction-area','换一种 Bit（轴尖）'],['ph-inertia','调外圈配重'],['ph-com-height','换 Ratchet 高度'],['ph-wing-contact','改翼片数量'],['ph-launch-rpm','改发射转速']];
export function templateExperiment({names=['A','B'], variable={}, prediction=null, metric={}, stats={}, trials=[]}={}) {
  const verdict = experimentVerdict(stats), A = stats.A||{}, B = stats.B||{};
  const me = `你的 ${names[0]||'陀螺'}`, from = variable.from ?? '原来', to = variable.to ?? '新设置', label = variable.label || '这个变量';
  const n = Math.max(+A.trials||0, +B.trials||0, trials.length||0);
  const winsTxt = `${label}为「${to}」时赢 ${B.wins??0}/${B.trials??n} 次，「${from}」时赢 ${A.wins??0}/${A.trials??n} 次`;
  const timeTxt = A.avgTime!=null && B.avgTime!=null ? `，平均坚持 ${(+B.avgTime).toFixed(1)} 秒 vs ${(+A.avgTime).toFixed(1)} 秒` : '';
  const conclusion = `${winsTxt}${timeTxt}。在这个模型里，${verdict==='B更好'?`改成「${to}」更好`:verdict==='A更好'?`原来的「${from}」更好`:'两种差不多'}。`;
  const cardId = variableCard(variable);
  // Consistency across trials: did the player win in the same configurations each time?
  const bw = trials.filter(t=>t?.B?.winner===0).length, aw = trials.filter(t=>t?.A?.winner===0).length, m = trials.length;
  const consistent = m>0 && (bw===0||bw===m) && (aw===0||aw===m);
  const clear = m>0 && Math.abs(bw-aw) >= Math.ceil(m/2);
  const repeatLesson = !m ? '多做几次同样的实验，结论才可靠。'
    : consistent ? `${m} 次结果都一样，说明这个差别很稳定，不是运气。`
    : clear ? `改成「${to}」${m} 次赢 ${bw} 次，原来赢 ${aw} 次——大多数时候都这样，不只是运气。`
    : `${m} 次里结果不太一样，碰撞很敏感，要多做几次才能看清规律。`;
  const actual = verdict==='B更好'?'more':verdict==='A更好'?'less':'same';
  const predictionFeedback = !prediction ? '下次先猜一猜，再看实验结果！'
    : prediction===actual ? '你猜对了！科学家的直觉 👍' : '和你猜的不一样——这正是实验的意义！';
  const next = NEXT_VARS.find(([c])=>c!==cardId) || NEXT_VARS[0];
  return {verdict, conclusion: conclusion.slice(0,90), why: VAR_WHY[cardId] || VAR_WHY['sm-control'], repeatLesson, predictionFeedback, cardId, nextIdea:`下次只${next[1]}，其他都不变，看看会怎样？`, fallback:true};
}

// ── Free question ──
export function templateAsk(question='') {
  const cards = relevantCards(question, 2);
  const c = cards[0] || getCard('bx-three-parts');
  return {answer: `${c.title}：${c.body}`, cards: (cards.length?cards:[c]).map(({id,title,body,layer})=>({id,title,body,layer})), fallback:true};
}

export {CARDS};
