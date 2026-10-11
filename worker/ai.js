// AI routes. Mounted by worker/index.js under /api/ai/*.
// Provider order: 1) Claude through Cloudflare AI Gateway unified billing (env.AI binding, gateway "default",
// model env.LLM_MODEL) → 2) optional env-gated Claude via Vercel AI Gateway / Anthropic API keys →
// 3) Workers AI gpt-oss-120b → 4) deterministic template (in each route). Each step falls back on error.
import Anthropic from '@anthropic-ai/sdk';
// Every route returns a deterministic template fallback when the model fails or times out.
import {sanitizeCandidate, templateFusion, templateCommentary, templateAsk, fusionName, keptParts, needsClarify, STYLE_ZH, CLARIFY, fmtT, fmtRpm, fmtV, tidyNumbers, suggestTryNext, variableFacts, ownName, templateMoments, templateMoment, momentCard, templateQuiz, sanitizeQuiz, templateDJ, sanitizeCandidate as _sc, designTakeaway, templateExperiment, experimentVerdict, variableCard, sanitizePage, templateFlipPage, templateFlipTap, FLIP_STYLE, bankGate, GATE_BANK} from '../src/ai/fallback.js';
import {CARDS, getCard, relevantCards} from '../src/knowledge/cards.js';
import {TIPS} from '../src/physics/model.js';
import {regionById} from '../src/game/regions.js';
import {prototypeOf} from '../src/game/prototypes.js';
import {SCENES, sceneByKey, START_SCENE} from '../src/game/scenes.js';
import {BEYS} from '../src/game/beys.js';
import {BLADERS} from '../src/game/story.js';

export const MODEL = globalThis.process?.env?.AI_MODEL || '@cf/openai/gpt-oss-120b';
// Per-route budgets: Claude gets CLAUDE_MS, the Workers AI fallback gets TIMEOUT_MS after that.
const TIMEOUT_MS = {explore:10000, flip:10000, fusion:20000, commentary:12000, ask:10000, moments:12000, experiment:12000, sketch:25000};
const CLAUDE_MS = {explore:14000, flip:20000, fusion:22000, sketch:28000, moments:18000, experiment:12000, commentary:12000, ask:10000};
// Model split: quality/vision routes use the smart model, live-feedback routes use the fast one.
// moments is on the smart model: Haiku's quizzes/analogies were physically wrong in tests (Sonnet ~13 s, correct).
const SMART_KINDS = new Set(['fusion','sketch','moments','flip']);
export const modelFor = (env, kind) => SMART_KINDS.has(kind) ? (env?.LLM_MODEL_SMART || env?.LLM_MODEL || 'anthropic/claude-sonnet-5.5') : (env?.LLM_MODEL_FAST || 'anthropic/claude-haiku-5.5');
export const CF_CLAUDE_MODEL = 'anthropic/claude-sonnet-5.5';
export const CLAUDE_MODEL = 'claude-sonnet-5-5';
export const GATEWAY_URL = 'https://ai-gateway.vercel.sh';
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export function contentOf(r) {
  if (r==null) return '';
  if (typeof r==='string') return r;
  if (typeof r.response==='string') return r.response;
  const c = r.choices?.[0]?.message?.content ?? r.result?.choices?.[0]?.message?.content ?? r.result?.response
    ?? (Array.isArray(r.content) ? r.content : null);
  if (Array.isArray(c)) return c.filter(p=>p?.type==='text').map(p=>p.text).join('');   // content-part arrays
  return typeof c==='string' ? c : (c ? JSON.stringify(c) : '');
}
export function parseJSON(text) {
  if (!text) return null;
  let t = String(text).replace(/```(?:json)?/gi,'').trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf('{'); if (s<0) return null;
  let depth=0, inStr=false, esc=false;
  for (let i=s;i<t.length;i++) {
    const ch=t[i];
    if (inStr) { if (esc) esc=false; else if (ch==='\\') esc=true; else if (ch==='"') inStr=false; continue; }
    if (ch==='"') inStr=true; else if (ch==='{') depth++; else if (ch==='}' && --depth===0) { try { return JSON.parse(t.slice(s,i+1)); } catch { return null; } }
  }
  return null;
}
// Route every Workers AI call through AI Gateway (unified billing pays from gateway credits, not the free daily quota).
const gw = env => ({gateway:{id:env?.AI_GATEWAY_ID || 'default'}});
const withTimeout = (p, ms) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]);

// Claude via the official SDK. Gateway uses the same Messages API with a different base URL + model id.
function claudeClient(env) {
  if (env?.AI_GATEWAY_API_KEY) return {client:new Anthropic({apiKey:env.AI_GATEWAY_API_KEY, baseURL:GATEWAY_URL, maxRetries:0}), model:`anthropic/${CLAUDE_MODEL}`, via:'gateway'};
  if (env?.ANTHROPIC_API_KEY) return {client:new Anthropic({apiKey:env.ANTHROPIC_API_KEY, maxRetries:0}), model:CLAUDE_MODEL, via:'anthropic'};
  return null;
}
export const hasClaude = env => cfClaudeAvailable(env) || Boolean(env?.AI_GATEWAY_API_KEY || env?.ANTHROPIC_API_KEY);
async function callClaude(c, {system, user, images=[], maxTokens}, ms) {
  const content = [...images.map(({mediaType, data})=>({type:'image', source:{type:'base64', media_type:mediaType, data}})), {type:'text', text:user}];
  const params = {
    model:c.model, max_tokens:Math.max(maxTokens, 1024), system,
    // Short structured replies for kids: no extended reasoning between tools, low effort for latency.
    thinking:{type:'between_tools'}, output_config:{effort:'low'},
    messages:[{role:'user', content}],
  };
  const res = c.via==='anthropic'
    ? await c.client.beta.messages.create({...params, betas:['server-side-fallback-2026-07-01'], fallbacks:'default'}, {timeout:ms})
    : await c.client.messages.create(params, {timeout:ms});
  if (res.stop_reason==='refusal') throw new Error('refusal');
  return res.content.filter(b=>b.type==='text').map(b=>b.text).join('');
}
// Claude via the Workers AI binding routed through AI Gateway (unified billing). OpenAI-chat-style input;
// images as {type:'image_url', image_url:{url:dataUrl}} content parts.
let cfClaudeDownUntil = 0;   // per-isolate: skip Claude for 60 s after a balance/auth/model error
export const cfClaudeAvailable = env => Boolean(env?.AI) && Date.now() >= cfClaudeDownUntil;
async function callCfClaude(env, {system, user, images=[], maxTokens, model}, ms) {
  // Verified binding shape (Anthropic-native): top-level `system`, required max_tokens, image blocks as
  // {type:'image', source:{type:'base64', media_type, data}} before the text. Response is a native message
  // ({content:[{type:'text',text}]}) — contentOf() also handles choices[].
  const content = images.length ? [...images.map(({mediaType, data})=>({type:'image', source:{type:'base64', media_type:mediaType, data}})), {type:'text', text:user}] : user;
  const m = model || modelFor(env, 'fusion');
  const input = {system, messages:[{role:'user', content}], max_tokens:maxTokens + 1024, output_config:{effort:'low'}};   // headroom for adaptive thinking
  // Haiku 5.5 otherwise burns the whole budget on adaptive thinking for long JSON; disabled is allowed at effort ≤ high.
  if (/haiku/i.test(m)) input.thinking = {type:'disabled'};
  try {
    const r = await withTimeout(env.AI.run(m, input, gw(env)), ms);
    const text = contentOf(r);
    if (!text) throw new Error(`empty reply (stop=${r?.stop_reason ?? r?.choices?.[0]?.finish_reason}, blocks=${Array.isArray(r?.content)?r.content.map(b=>b.type).join('+'):typeof r}, out=${r?.usage?.output_tokens ?? r?.usage?.completion_tokens})`);
    return text;
  } catch (e) {
    const msg = String(e?.message||e);
    if (/2021|insufficient balance|insufficient ai gateway|unauthor|forbidden|no such model|401|403/i.test(msg)) cfClaudeDownUntil = Date.now() + 60_000;
    throw e;
  }
}
async function callWorkersAI(env, {system, user, maxTokens}, ms) {
  if (!env?.AI) throw new Error('no Workers AI binding');
  const r = await withTimeout(env.AI.run(MODEL, {messages:[{role:'system', content:system}, {role:'user', content:user}], max_tokens:maxTokens, reasoning_effort:'low'}, gw(env)), ms);
  return contentOf(r);
}
const tagVia = (o, via, note='') => Object.defineProperty(Object.defineProperty(o, '__via', {value:via, enumerable:false}), '__note', {value:note, enumerable:false});
// Hard physics rules of OUR model, given to every explaining prompt so the model can't invert causality.
export const MODEL_RULES = `本游戏物理模型的硬规则（不得违背）：
1. 外圈配重%只表示刃的重量有多少放在外圈；两只陀螺谁的转动惯量大，只能看“对比事实”。
2. X 冲刺：Bit 齿轮咬住齿轨，把转动变成往前冲；不会增加能量，冲刺后转速会下降。
3. 碰撞：转动能量变成弹开、晃动、热和声音；撞完转速只会掉，不会涨。
4. 停转：轴尖摩擦和空气阻力一直在慢慢消耗转速；转速低了角动量小，就会晃、会倒。
5. 越重的陀螺被撞时速度变化越小（动量 = 质量 × 速度）。`;
// One helper for every route. Returns parsed JSON (json:true) or text. Throws only if every provider failed.
export async function llm(env, {system, user, images=[], maxTokens=800, json:wantJson=true, kind='fusion', claudeOnly=false}) {
  const ms = TIMEOUT_MS[kind] || 12000, claudeMs = CLAUDE_MS[kind] || 12000, model = modelFor(env, kind), errors = [];
  const parse = (text, via) => { const out = wantJson ? parseJSON(text) : text; return out && wantJson ? tagVia(out, via, errors.join('; ').slice(0,200)) : out; };
  if (cfClaudeAvailable(env)) {
    try { const text = await callCfClaude(env, {system, user, images, maxTokens, model}, claudeMs); const out = parse(text, 'claude'); if (out) return out; errors.push(`cf-claude: unparseable (${String(text).length} chars) ${String(text).slice(0,60)}…${String(text).slice(-60)}`); }
    catch (e) { errors.push(`cf-claude: ${String(e.message||e).slice(0,160)}`); }
  }
  const c = claudeClient(env);   // optional extras, only when keys are configured
  if (c) {
    try { const out = parse(await withTimeout(callClaude(c, {system, user, images, maxTokens}, claudeMs), claudeMs), 'claude'); if (out) return out; errors.push(`${c.via}: unparseable`); }
    catch (e) { errors.push(`${c.via}: ${e.message||e}`); }
  }
  if (claudeOnly) throw new Error(errors.join('; ') || 'Claude unavailable');
  try {
    const out = parse(await callWorkersAI(env, {system, user, maxTokens: maxTokens+300}, ms), 'workers-ai');   // + room for gpt-oss reasoning
    if (out) return out;
    errors.push('workers-ai: unparseable');
  } catch (e) { errors.push(`workers-ai: ${e.message||e}`); }
  throw new Error(errors.join('; '));
}
// Back-compat shim for the routes written against [{system},{user}] message pairs.
async function runModel(env, messages, maxTokens=1400, kind='fusion') {
  const system = messages.find(m=>m.role==='system')?.content || '';
  const user = messages.filter(m=>m.role==='user').map(m=>m.content).join('\n');
  return llm(env, {system, user, maxTokens, kind});
}
// Cut at a sentence/clause boundary instead of mid-word.
export function clip(text='', max=70) {
  const t = String(text).trim(); if (t.length<=max) return t;
  const cut = t.slice(0, max), i = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'), cut.lastIndexOf('；'));
  if (i >= max*.5) return cut.slice(0, i+1);
  const j = cut.lastIndexOf('，'); return (j >= max*.5 ? cut.slice(0, j) : cut.slice(0, max-1)) + '…';
}
const cardLines = cards => cards.map(c=>`- ${c.id} [${c.layer}] ${c.title}：${c.body}`).join('\n');
const beyLine = b => `${b.name}（${b.zh||''}，${STYLE_ZH[b.blade?.style]||b.type}）：翼片${b.blade?.wings}，半径${((b.blade?.reach||.026)*1000).toFixed(1)}mm，外圈配重${b.blade?.ring}%，刃重${b.blade?.mass}g；Ratchet ${b.ratchet?.prongs}-${b.ratchet?.height}，Bit ${b.bit}`;

const COACH = `你是陀螺王国的“融合博士”，一个热血少年漫画风的 AI 教练，帮小学生把两只陀螺的 Blade 融合成新陀螺，并顺便教他真实的知识。
说话规则：中文，短句，热情有趣，不说教，不用难词；每句话不超过 30 个字。
融合规则（必须遵守）：
1. 只有 Blade 会融合改变；Ratchet 和 Bit 原样继承自孩子选择保留的那只陀螺，绝不改变。
2. 可调的 Blade 参数和范围：wings 翼片数 2|3|4；reach 刃半径 0.022~0.030（米）；ring 外圈配重比例 20~85（%）；mass 刃重 24~40（克）；style attack|defense|stamina|balance。
3. 物理取舍要真实：外圈配重高→转动惯量大→更持久；刃更重→更难被撞飞但同样发射力转速更低；半径大→碰撞力臂长、攻击强但更容易撞墙；翼片少→撞击更集中，翼片多→更圆滑。不要给任何参数编造额外超能力。
4. 起名用孩子的风格：两个名字拼接。例子：Fish + Dragoon = Fishgoon，GoatPuff + NinjaMight = NinjaPuff。
5. 每个候选引用 1~2 张知识卡（只能用下面给出的 id），讲解要和卡片内容一致。不要说“现实中一定赢”，对战结果只代表游戏里的理想化模型。
只输出一个 JSON 对象，不要任何其他文字。`;

async function fusionChat(body, env) {
  const parents = Array.isArray(body.parents) ? body.parents.slice(0,2) : [];
  if (parents.length<2) return json({error:'need two parents'}, 400);
  const keepParent = body.keepParent===1 ? 1 : 0;
  const wish = String(body.wish||'').slice(0,200);
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const fallback = () => templateFusion({parents, wish, history, keepParent});
  const askedBefore = history.some(h=>h.role==='assistant' && h.question);
  const kept = keptParts(parents, keepParent);
  const allWish = [wish, ...history.filter(h=>h.role==='user').map(h=>h.content)].join(' ');
  const cards = [...new Map([...relevantCards(allWish+' '+parents.map(p=>p.type).join(' '), 7), getCard('gd-fusion-blade-only'), getCard('ph-inertia'), getCard('ph-momentum'), getCard('ph-mass-tradeoff')].filter(Boolean).map(c=>[c.id,c])).values()];
  const user = `父陀螺 A：${beyLine(parents[0])}
父陀螺 B：${beyLine(parents[1])}
孩子选择保留 ${parents[keepParent].name} 的 Ratchet ${kept.ratchet.prongs}-${kept.ratchet.height} 和 Bit ${kept.bit}（${TIPS[kept.bit]?.label||''}：${TIPS[kept.bit]?.desc||''}）。
默认融合名：${fusionName(parents[0], parents[1])}
对话记录：${history.map(h=>`${h.role==='user'?'孩子':'博士'}：${h.content||h.question||''}`).join(' / ') || '（无）'}
孩子现在说：“${wish || '（没说）'}”
可引用的知识卡：
${cardLines(cards)}

${askedBefore || !needsClarify(allWish, []) ? '孩子的想法已经够清楚了，现在必须给出候选。' : '如果孩子的愿望太模糊（没说想要攻击、持久、防守还是平衡），先问一个简短问题；否则直接给候选。'}
输出格式二选一：
A（追问）：{"mode":"ask","reply":"一句回应","question":"一个简短问题","options":["选项1","选项2","选项3"]}
B（候选）：{"mode":"candidates","reply":"一句兴奋的开场","candidates":[{"name":"英文融合名","zh":"中文昵称≤6字","style":"attack|defense|stamina|balance","wings":3,"reach":0.027,"ring":70,"mass":34,"colors":{"primary":"#RRGGBB","secondary":"#RRGGBB","accent":"#RRGGBB"},"lore":"一句设定≤30字","why":"为什么这样设计，讲出物理原因≤45字","tradeoff":"代价是什么≤30字","prediction":"对战中可能出现的表现≤30字","cards":["卡片id"]}]}
候选给 2~3 个，彼此取舍明显不同，第一个最贴合孩子愿望。`;
  try {
    const out = await runModel(env, [{role:'system', content:COACH}, {role:'user', content:user}]);
    if (out.mode==='ask' && !askedBefore && out.question) {
      const options = (Array.isArray(out.options)?out.options:[]).map(o=>String(o).slice(0,24)).filter(Boolean).slice(0,3);
      return json({reply:String(out.reply||CLARIFY.reply).slice(0,60), question:String(out.question).slice(0,60), options: options.length>=2?options:CLARIFY.options, via:out.__via});
    }
    const raw = Array.isArray(out.candidates) ? out.candidates.slice(0,3) : [];
    const candidates = raw.map(c=>sanitizeCandidate(c, parents, keepParent, 'ai'));
    // De-duplicate ids (same params+name) and top up with templates if the model gave too few.
    const seen = new Set(), uniq = candidates.filter(c=>!seen.has(c.id) && seen.add(c.id));
    const names = new Set(); uniq.forEach((c,i)=>{ if (names.has(c.name)) c.name = `${c.name} ${['II','X','Z'][i-1]||i}`; names.add(c.name); });
    if (uniq.length<2) for (const t of templateFusion({parents, wish:allWish, history:[{role:'assistant',question:'x'}], keepParent}).candidates||[]) if (uniq.length<2 && !seen.has(t.id)) { seen.add(t.id); uniq.push(t); }
    return json({reply:String(out.reply||'融合完成！看看这几个方案！').slice(0,60), candidates:uniq, via:out.__via, aiNote:out.__note||undefined});
  } catch (e) {
    return json({...fallback(), error:String(e.message||e)});
  }
}

async function commentary(body, env) {
  const summary = body.summary || {};
  const names = Array.isArray(body.names) ? body.names.slice(0,2).map(String) : ['A','B'];
  const fallback = () => templateCommentary(summary, names);
  const who = i => i===0 ? `你的 ${names[0]}` : names[1];   // body 0 is always the kid's own bey
  const ev = (summary.events||[]).filter(e=>e.type!=='dash').slice(0,12).map(e=>e.type==='collision'
    ? `${fmtT(e.time)} 碰撞，相对速度 ${fmtV(e.relSpeed)}，撞完 ${who(0)} ${fmtRpm(e.rpm?.[0])}、${who(1)} ${fmtRpm(e.rpm?.[1])}`
    : `${fmtT(e.time)} ${e.type}${e.reason?' '+e.reason:''}${e.winner!=null?'，胜者 '+who(e.winner):''}`);
  const dashes = (summary.events||[]).filter(e=>e.type==='dash').length;
  const BIT = {needle:'尖轴',ball:'圆轴',flat:'平轴',rush:'冲刺轴'};
  const parts = (summary.parts||[]).map((p,i)=>`${who(i)}：${STYLE_ZH[p.style]||p.style}，翼${p.wings}片，外圈配重${p.ring}%，总重${(+p.massG).toFixed(1)}g，${BIT[p.tip]||p.tip}，Ratchet 高${p.height}，转动惯量 ${(p.inertiaZ*1e6).toFixed(1)}`).join('\n');
  const stats = (summary.stats||[]).map((s,i)=>`${who(i)}：碰撞${s.hits}次，最高速度 ${fmtV(s.maxSpeed)}`).join('；');
  const r = summary.result||{};
  const P = summary.parts||[];
  const cmp = (k, label) => P.length===2 && P[0][k]!=null && P[1][k]!=null ? (P[0][k]===P[1][k] ? `${label}一样` : `${label}更大的是 ${who(P[0][k]>P[1][k]?0:1)}`) : null;
  const facts = [cmp('inertiaZ','转动惯量'), cmp('massG','总重'), cmp('ring','外圈配重'), cmp('reach','刃半径')].filter(Boolean).join('；');
  const cards = relevantCards(`${r.reason} 撞 碰撞 持久 惯量 摩擦 ${P.map(p=>p.style+' '+p.tip).join(' ')}`, 5);
  const hint = suggestTryNext(summary, names);
  const user = `陀螺对战刚结束（理想化物理模型，未经实物校准）。
${parts}
事件：${ev.join('；') || '无碰撞'}；X Dash 冲刺 ${dashes} 次。
统计：${stats}
对比事实（不得矛盾）：${facts||'无'}
结果：${who(r.winner)} 获胜（${r.winner==null?'':({spin:`${who(1-r.winner)} 先停转倒下，${who(r.winner)} 还在转`,over:`${who(1-r.winner)} 飞出了场地`,xtreme:`${who(1-r.winner)} 掉进了 Xtreme 口`,judge:`时间到，${who(r.winner)} 转速更高`})[r.reason]||''}；不要把输的一方说成赢家），${r.reason}（xtreme=Xtreme终结3分，over=出界2分，spin=停转1分，judge=时间到按转速判定1分），${r.points}分，用时 ${fmtT(r.time)}。
知识卡：
${cardLines(cards)}
给小学生做热血复盘。规则：玩家的陀螺一律叫“你的 ${names[0]}”；只用上面给的数字，原样照抄格式（时间如“0.5 秒”，转速如“约 6,500 转/分”）；不要编造事件；“撞完”的转速只是那一刻的数值，不要说上升；因果判断说“在这个模型里”。
tryNext 只能建议改“你的 ${names[0]}”的一个地方（外圈配重/翼片/类型/Ratchet 高度/Bit 之一），绝不改对手，例如：“${hint}”
只输出 JSON：{"headline":"≤14字","story":["3个短句"],"science":{"cardId":"卡片id","body":"结合本场讲知识≤50字"},"tryNext":"≤36字"}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是陀螺对战的热血解说员兼科学老师。中文，短句，有趣，诚实。只输出 JSON。'}, {role:'user', content:user}], 600, 'commentary');
    const card = getCard(out.science?.cardId) || getCard(fallback().science.cardId);
    const story = (Array.isArray(out.story)?out.story:[]).map(s=>clip(ownName(tidyNumbers(String(s)), names[0], names[1]),72)).filter(Boolean).slice(0,4);
    if (!story.length || !out.headline) throw new Error('incomplete');
    let sciBody = tidyNumbers(String(out.science?.body||card.body)).slice(0,90);
    if (!sciBody.includes('模型')) sciBody += '（在这个模型里）';
    // tryNext must target the player's own bey; otherwise use the deterministic suggestion.
    let tryNext = tidyNumbers(String(out.tryNext||''));
    if (!tryNext || (names[1] && tryNext.includes(names[1]) && !tryNext.includes(names[0])) || !(tryNext.includes(names[0])||tryNext.includes('你的'))) tryNext = hint;
    return json({headline:tidyNumbers(String(out.headline)).slice(0,20), story, science:{cardId:card.id, title:card.title, body:sciBody, layer:card.layer}, tryNext:tryNext.slice(0,60), via:out.__via, aiNote:out.__note||undefined});
  } catch (e) {
    return json({...fallback(), error:String(e.message||e)});
  }
}

async function moments(body, env) {
  const summary = body.summary || {}, list = Array.isArray(body.moments) ? body.moments.slice(0,6) : [];
  const names = Array.isArray(body.names) ? body.names.slice(0,2).map(String) : ['A','B'];
  const fallback = () => templateMoments(summary, list, names);
  if (!list.length) return json(fallback());
  const who = i => i===0 ? `你的 ${names[0]}` : names[1];
  const BIT = {needle:'尖轴',ball:'圆轴',flat:'平轴',rush:'冲刺轴'};
  const P = summary.parts || [];
  const parts = P.map((p,i)=>`${who(i)}：${STYLE_ZH[p.style]||p.style}，翼${p.wings}片，外圈配重${p.ring}%，${(+p.massG).toFixed(1)}g，${BIT[p.tip]||p.tip}，Ratchet 高${p.height}`).join('\n');
  const line = m => {
    const d = m.data||{}, bits = [];
    if (d.relSpeed!=null) bits.push(`相对速度 ${fmtV(d.relSpeed)}`);
    if (d.rpmBefore && d.rpmAfter) [0,1].forEach(i=>{ const drop=Math.abs(d.rpmBefore[i])-Math.abs(d.rpmAfter[i]); bits.push(`${who(i)} ${fmtRpm(d.rpmBefore[i])}→${fmtRpm(d.rpmAfter[i])}${drop>50?`（掉了约 ${(Math.round(drop/100)*100).toLocaleString('en-US')} 转）`:''}`); });
    if (d.drop!=null) bits.push(`转速掉了约 ${(Math.round(Math.abs(d.drop)/100)*100).toLocaleString('en-US')} 转`);
    if (d.window) bits.push(`在 ${d.window} 秒内`);
    if (d.cause==='collision') bits.push(`原因：${d.hitTime!=null?fmtT(d.hitTime)+'的':''}一次碰撞（必须说是碰撞导致的）`);
    if (d.cause==='friction') bits.push('原因：这段时间没有碰撞，是轴尖摩擦消耗（不要说成碰撞）');
    if (d.reason) bits.push(`方式 ${d.reason}`); if (d.winner!=null) bits.push(`胜者 ${who(d.winner)}`);
    return `- id=${m.id} ${fmtT(m.time)} ${m.kind}${m.body!=null?' 主角 '+who(m.body):''}：${bits.join('，')}（建议卡片 ${momentCard(m)}）`;
  };
  const cardIds = [...new Set(list.map(momentCard).concat(['ph-energy-convert','ph-inertia','ph-momentum','ph-tilt-fall']))];
  const r = summary.result || {};
  const cmp = (k, label) => P.length===2 && P[0][k]!=null && P[1][k]!=null && P[0][k]!==P[1][k] ? `${label}更大的是 ${who(P[0][k]>P[1][k]?0:1)}` : null;
  const facts = [cmp('inertiaZ','转动惯量'), cmp('massG','总重'), cmp('ring','外圈配重')].filter(Boolean).join('；');
  // Quizzes only from Claude (open models invert causality and are too slow for the extra output).
  const wantQuiz = hasClaude(env);
  const user = `陀螺对战回放的关键时刻（真实模拟数据，理想化物理模型）。
${parts}
对比事实（不得矛盾）：${facts||'无'}
${MODEL_RULES}
结果：${who(r.winner)} 获胜（${r.reason}）。
关键时刻：
${list.map(line).join('\n')}
知识卡：
${cardIds.map(id=>getCard(id)).filter(Boolean).map(c=>`- ${c.id} ${c.title}：${c.body}`).join('\n')}
读者是 10 岁小朋友。为每个时刻写：
- title（≤10字，热血漫画风，如“龙翼猛撞！”）
- explain（≤55字：发生了什么+为什么；最多引用 1~2 个数字，照抄上面的格式（如“1.9 m/s”“约 1,300 转”）并解释含义，不要罗列；因果判断说“在这个模型里”；物理原因只能来自知识卡和对比事实）
- dj（≤24字，像动画里的陀螺比赛 DJ 一样喊出来，如“出现了！龙翼的逆风一击——！”）
${wantQuiz ? `- quiz：一个“你猜？”问题，问这个时刻“为什么”会发生。q≤26字；options 恰好 2 个短选项（≤14字），一个对一个错，正确的随机放在第 0 或第 1 个；answer 是正确选项下标；reveal≤55字讲清正确原因（必须符合知识卡和对比事实）；analogy≤36字，用 10 岁孩子熟悉的生活例子打比方（花样滑冰收手臂、自行车骑快不倒、保龄球撞瓶、碰碰车、转硬币…）
` : ''}- cardId（从知识卡选）
玩家的陀螺叫“你的 ${names[0]}”。不要编造上面没有的事件。takeaway 一句话（≤45字）：把结果和“你的 ${names[0]}”的设计选择（配重/轴尖/翼片/高度）联系起来。
只输出 JSON：{"headline":"≤14字","moments":[{"id":"","title":"","explain":"","dj":"",${wantQuiz?'"quiz":{"q":"","options":["",""],"answer":0,"reveal":"","analogy":""},':''}"cardId":""}],"takeaway":""}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是热血漫画风的陀螺解说员兼科学老师。中文短句，诚实，只输出 JSON。'}, {role:'user', content:user}], wantQuiz ? 1400 : 650, 'moments');
    const got = new Map((Array.isArray(out.moments)?out.moments:[]).map(m=>[String(m.id), m]));
    const merged = list.map(m=>{
      const t = templateMoment(m, names), o = got.get(String(m.id));
      if (!o) return t;
      return {id:m.id, title:clip(tidyNumbers(String(o.title||t.title)),14), explain:clip(ownName(tidyNumbers(String(o.explain||t.explain)), names[0], names[1]),80),
        cardId:getCard(o.cardId)?o.cardId:t.cardId, dj:clip(String(o.dj||t.dj),28),
        // Smaller open models invert causality in quizzes; only trust Claude's, else the vetted template.
        quiz: out.__via==='claude' ? sanitizeQuiz(o.quiz, m) : t.quiz};
    });
    let takeaway = clip(ownName(tidyNumbers(String(out.takeaway||'')), names[0], names[1]),60);
    if (!takeaway || !takeaway.includes('你的')) takeaway = designTakeaway(summary, names);
    return json({headline:String(out.headline||fallback().headline).slice(0,16), moments:merged, takeaway, via:out.__via, aiNote:out.__note||undefined});
  } catch (e) {
    return json({...fallback(), error:String(e.message||e)});
  }
}

async function experiment(body, env) {
  const names = Array.isArray(body.names) ? body.names.slice(0,2).map(String) : ['A','B'];
  const input = {names, variable:body.variable||{}, prediction:['more','less','same'].includes(body.prediction)?body.prediction:null, metric:body.metric||{}, stats:body.stats||{}, trials:Array.isArray(body.trials)?body.trials.slice(0,10):[]};
  const base = templateExperiment(input);       // deterministic verdict, consistency, card, prediction check
  const {variable, stats, trials, prediction} = input, A = stats.A||{}, B = stats.B||{};
  const me = `你的 ${names[0]}`;
  const row = (k,x) => `${k}（${k==='A'?`原来：${variable.from}`:`改成：${variable.to}`}）：赢 ${x.wins??0}/${x.trials??trials.length} 次，平均用时 ${fmtT(x.avgTime)}，3 秒时转速 ${fmtRpm(x.avgRpm3)}，平均碰撞 ${(+x.avgHits||0).toFixed(1)} 次`;
  const tr = trials.map((t,i)=>`第${i+1}次：A ${t.A?.winner===0?'赢':'输'}（${t.A?.reason}，${fmtT(t.A?.time)}），B ${t.B?.winner===0?'赢':'输'}（${t.B?.reason}，${fmtT(t.B?.time)}）`).join('；');
  const card = getCard(base.cardId);
  const predZh = {more:'改了以后会更好', less:'改了以后会更差', same:'差不多'}[prediction] || '没有预测';
  const user = `小朋友做了一个控制变量实验（理想化物理模型模拟）。
${me} 对战 ${names[1]}，只改了一个变量：${variable.label}，从「${variable.from}」改成「${variable.to}」，其他全都不变，每种各比 ${trials.length||A.trials||3} 次。
${row('A',A)}
${row('B',B)}
每次结果：${tr||'无'}
已算好的结论（必须照用，不得改变）：verdict=${base.verdict}；重复性：${base.repeatLesson}
孩子的预测：${predZh}；预测对比：${base.predictionFeedback}
这个变量的物理事实（why 必须和它一致）：${variableFacts(variable)}
相关知识卡：${card.id} ${card.title}：${card.body}
请用小学生能懂的话写：conclusion（≤50字，只引用胜场和平均用时两个数字，说“在这个模型里”）；why（≤70字，根据“物理事实”解释为什么改${variable.label}会这样）；repeatLesson（≤45字，根据每次结果说重复实验的意义）；predictionFeedback（≤35字，温暖，和孩子预测比较）；nextIdea（≤36字，建议下次只改另一个变量，比如轴尖/外圈配重/Ratchet 高度/翼片数/发射转速中的一个，不要和${variable.label}重复）。
只输出 JSON：{"conclusion":"","why":"","repeatLesson":"","predictionFeedback":"","nextIdea":""}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是陀螺王国的科学老师，带小学生做实验。中文短句，鼓励，诚实，只输出 JSON。'}, {role:'user', content:user}], 650, 'experiment');
    const pick = (k, max) => { const v = ownName(tidyNumbers(String(out[k]||'')).trim(), names[0], names[1]); return (v || base[k]).slice(0, max); };
    let conclusion = pick('conclusion', 80);
    if (!conclusion.includes('模型')) conclusion = conclusion.replace(/。?$/, '（在这个模型里）。');
    return json({verdict:base.verdict, conclusion, why:pick('why',110), repeatLesson:pick('repeatLesson',70), predictionFeedback:pick('predictionFeedback',50), cardId:base.cardId, nextIdea:pick('nextIdea',50), via:out.__via, aiNote:out.__note||undefined});
  } catch (e) {
    return json({...base, error:String(e.message||e)});
  }
}

// Vision: a kid's drawing/photo of a dream bey → validated Bey. Claude only.
async function sketch(body, env) {
  if (!hasClaude(env)) return json({needKey:true, error:'需要家长开启高级 AI'}, 503);
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imageDataUrl||''));
  if (!m) return json({error:'bad image'}, 400);
  if (m[2].length > 5_500_000) return json({error:'image too large'}, 413);
  const wish = String(body.wish||'').slice(0,120);
  const kp = body.keepParts || {};
  const base = {id:'sketch', name:'Sketch', ratchet:{height:kp.ratchet?.height ?? 60, prongs:kp.ratchet?.prongs ?? 3}, bit:kp.bit || 'ball'};
  const cards = [getCard('ph-inertia'), getCard('ph-wing-contact'), getCard('ph-momentum'), getCard('ph-mass-tradeoff'), getCard('mt-metal'), getCard('bx-types'), getCard('gd-ideal-model')].filter(Boolean);
  const system = `你是陀螺王国的“融合博士”。小朋友（约 10 岁）画了一只梦想陀螺，你要把画变成游戏里能用的 Blade 设计。中文，短句，热血漫画风，诚实。只输出 JSON。`;
  const user = `看这张画${wish?`，小朋友说：“${wish}”`:''}。
把画里的特征翻译成 Blade 参数（只能用这些范围）：wings 翼片数 2|3|4（数画里的刃/角/翅膀，取最接近的）；reach 刃半径 0.022~0.030 米（刃伸得越远越大）；ring 外圈配重 20~85%（画里外圈厚重/有金属感就高）；mass 刃重 24~40 克；style attack|defense|stamina|balance（尖刺多→attack，厚圆→defense，圆滑对称→stamina，其他→balance）。
颜色从画里取：primary 主色、secondary 副色、accent 点缀色（#RRGGBB）。Ratchet ${base.ratchet.prongs}-${base.ratchet.height} 和 Bit ${base.bit} 保持不变。
specialMove：给它起一个必杀技，name≤8字，shout≤16字（动画里喊招式那样）。
why≤60字：说出你从画里看到了什么（“我看到你画了 4 片尖尖的翅膀…”），以及这对物理表现意味着什么。
cards：从下面选 1~2 张最相关的知识卡 id：
${cards.map(c=>`- ${c.id} ${c.title}：${c.body}`).join('\n')}
不要声称它在现实中一定强；游戏里的表现由理想化物理模型计算。
只输出 JSON：{"name":"英文名","zh":"中文昵称≤6字","style":"","wings":3,"reach":0.027,"ring":70,"mass":34,"colors":{"primary":"#","secondary":"#","accent":"#"},"lore":"≤30字","specialMove":{"name":"","shout":""},"why":"","tradeoff":"≤30字","cards":[""]}`;
  try {
    const out = await llm(env, {system, user, images:[{mediaType:m[1], data:m[2]}], maxTokens:1200, kind:'sketch', claudeOnly:true});
    const bey = sanitizeCandidate(out, [base], 0, 'sketch');
    bey.parents = []; delete bey.keptFrom; bey.drawn = true;
    const sm = out.specialMove || {};
    bey.specialMove = {name:String(sm.name||'必杀旋风').slice(0,10), shout:String(sm.shout||'旋转吧——！').slice(0,20)};
    if (!out.zh) bey.zh = '梦想陀螺';
    if (!out.lore) bey.lore = '从小画家的画里诞生的陀螺。';
    return json({bey, via:out.__via, aiNote:out.__note||undefined});
  } catch (e) {
    const msg = String(e.message||e);
    if (/2021|insufficient|unavailable|unauthor|401|403/i.test(msg) || !hasClaude(env)) return json({needKey:true, error:'需要家长开启高级 AI'}, 503);
    return json({error:msg}, 502);
  }
}

// ── AI 科学绘本 ──
const FLIP_SYSTEM = `你是“融合博士”，在给一个 10 岁的孩子做一本可以点来点去的漫画科学绘本，主题是陀螺（Beyblade X）和它背后的物理。
每一页：一个大画面（由图像模型画，画里不能有任何文字）+ 叠在画上的中文对白框 + 3~4 个画里可以点的“好奇点”。
写作要求：中文，短句，热血漫画语气，讲清楚一个知识点；内容必须物理正确，只依据给出的知识卡和硬规则；只有说到游戏里的模拟时才说“在这个模型里”。
${MODEL_RULES}
只输出 JSON。`;
const FLIP_SCHEMA = `{"title":"外圈越重越稳","panels":[{"text":"看！配重都跑到外圈去了！","kind":"caption","x":0.05,"y":0.05},{"text":"重量离中心越远，陀螺越难被弄停。","kind":"bubble","x":0.6,"y":0.72}],"imagePrompt":"a battle spinning top seen from above, heavy metal weights glowing on its outer rim, curved arrows around the rim, a small figure skater with arms stretched out in the corner","hotspots":[{"x":0.8,"y":0.45,"label":"外圈配重","hint":"outer rim weights: mass far from the axis raises moment of inertia"},{"x":0.5,"y":0.5,"label":"中心轴","hint":"spin axis: angular momentum points along it"},{"x":0.15,"y":0.8,"label":"滑冰手","hint":"figure skater: arms out = spins slower, arms in = faster"}],"cardId":"ph-inertia"}`;
const FLIP_FIELDS = `字段要求：title≤12字；panels 2~4 个，text≤50字，kind 为 caption/bubble/label；imagePrompt 用英文描述一幅能“看懂”这个知识的漫画画面（具体物体、箭头、动作线、人物），绝不要求画任何文字、字母、数字、标签或对话框；hotspots 3~4 个，label≤6字，hint 用英文写“这是什么+背后更深的知识”；cardId 从知识卡选。上面只是格式示例，内容要按本页主题重写。`;
const FLIP_LAYOUT = `布局：panels 2~4 个，x,y 是对白框左上角在画面中的位置（0~1），放在画面边角、别挡住 hotspots；hotspots 3~4 个，坐标指向 imagePrompt 里画出来的具体物体（比如轴尖、外圈配重、火花、齿轨），彼此分开。`;
function flipCards(text, extra=[]) {
  const ids = new Set([...relevantCards(text, 6).map(c=>c.id), ...extra, 'ph-inertia','ph-friction-area','ph-energy-convert','ph-gyro-stability']);
  return [...ids].map(getCard).filter(Boolean).slice(0,10);
}
async function flipStart(body, env) {
  const card = getCard(body.cardId);
  const bey = body.bey && typeof body.bey==='object' ? body.bey : null;
  const mom = body.moment && typeof body.moment==='object' ? body.moment : null;
  const topic = String(body.topic||'').slice(0,80);
  const seed = card ? card.title+' '+card.tags.join(' ') : topic || (mom ? `${mom.kind} ${mom.title||''}` : bey ? `${bey.type} ${bey.bit}` : '陀螺 结构');
  const fallback = () => templateFlipPage({cardId: card?.id, topic: seed});
  const cards = flipCards(seed, card ? [card.id] : []);
  const ctx = [
    card && `从这张知识卡开始：${card.id} ${card.title}：${card.body}`,
    topic && `孩子想了解：${topic}`,
    bey && `孩子的陀螺：${bey.name}（${STYLE_ZH[bey.blade?.style]||''}，翼${bey.blade?.wings}片，外圈配重${bey.blade?.ring}%，Bit ${bey.bit}，Ratchet ${bey.ratchet?.prongs}-${bey.ratchet?.height}），从它身上的一个物理知识讲起`,
    mom && `刚才对战回放里的一个时刻：${mom.title||mom.kind}，${mom.explain||''}`,
  ].filter(Boolean).join('\n') || '从“陀螺为什么能一直转”讲起';
  const user = `${ctx}
知识卡：
${cardLines(cards)}
${FLIP_LAYOUT}
写绘本的第一页。\n${FLIP_FIELDS}\n只输出 JSON，格式示例：${FLIP_SCHEMA}`;
  try {
    const out = await llm(env, {system:FLIP_SYSTEM, user, maxTokens:900, kind:'flip'});
    return json({page: sanitizePage(out, card?.id || cards[0]?.id), via: out.__via, aiNote: out.__note||undefined});
  } catch (e) { return json({page: fallback(), fallback:true, error:String(e.message||e).slice(0,200)}); }
}
async function flipTap(body, env) {
  const page = body.page || {}, x = Math.max(0, Math.min(1, +body.x||.5)), y = Math.max(0, Math.min(1, +body.y||.5));
  const trail = (Array.isArray(body.trail) ? body.trail : []).slice(-8).map(String);
  const fallback = () => templateFlipTap(page, x, y);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imageDataUrl||''));
  const cards = flipCards(`${page.title} ${(page.hotspots||[]).map(h=>h.label+' '+h.hint).join(' ')}`, [page.cardId].filter(Boolean));
  const user = `这是绘本的当前页（画面上的红圈 = 孩子刚点的位置，坐标 x=${x.toFixed(2)}, y=${y.toFixed(2)}）。
当前页 JSON：${JSON.stringify({title:page.title, panels:(page.panels||[]).map(p=>p.text), hotspots:page.hotspots, cardId:page.cardId, imagePrompt:page.imagePrompt})}
已经看过的页：${trail.join(' → ') || '（无）'}
先判断孩子点的是画里的什么东西（结合画面和 hotspots；点到空白处就选最近的 hotspot），然后写下一页：沿着这个东西往更深一层或相关的知识走（例如点轴尖→摩擦和接触面积；点外圈→转动惯量→花样滑冰；点火花→碰撞中的能量转换；点齿轨→X 冲刺）。不要重复已经看过的页。第一个 panel 用一句话回应“你点的是…”。
知识卡：
${cardLines(cards)}
${FLIP_LAYOUT}
${FLIP_FIELDS} 另加 tapped 字段：孩子点的东西（≤8字）。
只输出 JSON，格式示例：${FLIP_SCHEMA.replace('{"title"','{"tapped":"外圈配重","title"')}`;
  try {
    const out = await llm(env, {system:FLIP_SYSTEM, user, images: m ? [{mediaType:m[1], data:m[2]}] : [], maxTokens:900, kind:'flip'});
    return json({page: sanitizePage(out, cards[0]?.id), tapped: String(out.tapped||'').slice(0,10), via: out.__via, aiNote: out.__note||undefined});
  } catch (e) { return json({page: fallback(), fallback:true, error:String(e.message||e).slice(0,200)}); }
}
let kleinDownUntil = 0;
async function flipImage(body, env) {
  const prompt = String(body.prompt||'').slice(0,800);
  if (!prompt) return json({error:'empty prompt'}, 400);
  if (!env?.AI) return json({error:'no image model'}, 503);
  const full = `${prompt}. ${FLIP_STYLE}`, errors = [];
  // Primary: FLUX.2 klein 9B (multipart, 4:3). Through AI Gateway the binding's multipart path currently fails
  // (stream → 'ReadableStreams not supported', buffered → 8001 Invalid input), so after such an error skip it for 10 min.
  if (Date.now() >= kleinDownUntil) try {
    const form = new FormData(); form.append('prompt', full); form.append('width', '1024'); form.append('height', '768');
    const fr = new Response(form), ct = fr.headers.get('content-type');
    // AI Gateway rejects ReadableStream bodies → buffer the multipart payload first.
    const buf = await fr.blob();
    const r = await withTimeout(env.AI.run('@cf/black-forest-labs/flux-2-klein-9b', {multipart:{body:buf, contentType:ct}}, gw(env)), 20000);
    const img = r?.image || r?.result?.image;
    if (img) return json({image:`data:image/jpeg;base64,${img}`, model:'flux-2-klein-9b'});
    errors.push('klein: no image');
  } catch (e) { const m = String(e.message||e); errors.push('klein: '+m.slice(0,120)); if (/8001|ReadableStream|Invalid input/i.test(m)) kleinDownUntil = Date.now() + 600_000; }
  try {
    const r = await withTimeout(env.AI.run('@cf/black-forest-labs/flux-1-schnell', {prompt:full, steps:4}, gw(env)), 25000);
    if (r?.image) return json({image:`data:image/jpeg;base64,${r.image}`, model:'flux-1-schnell', note:errors.join('; ')});
    errors.push('schnell: no image');
  } catch (e) { errors.push('schnell: '+String(e.message||e).slice(0,120)); }
  return json({error:errors.join('; ')}, 502);
}

// ── 探索：AI Game Master ──
// The map is a fixed scene graph (scenes.js). Code decides WHERE things are hidden (per-run hide plan), whether this
// step awards something, and pacing; the GM (Haiku) only writes the story, clues, gates and geo facts.
const PACE_FORCE = 5;   // steps without a find/meet before the server reveals one at the current scene
const shuffle = a => { const b = [...a]; for (let i=b.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [b[i],b[j]] = [b[j],b[i]]; } return b; };
const bladerById = id => BLADERS.find(b=>b.id===id);
const clean2 = (v, n) => String(v||'').replace(/[（(]?\b(?:bx|ph|mt|sm|gd|geo)-[a-z0-9-]+\b[)）]?/g,'').trim().slice(0, n);
function exploreManifest(region, state) {
  const found = new Set(state.found||[]), met = new Set(state.met||[]);
  return {beysLeft: region.beys.filter(id=>!found.has(id)), bladersLeft: region.bladers.filter(id=>!met.has(id))};
}
const itemLabel = id => BEYS[id] ? `陀螺 ${BEYS[id].name}（${BEYS[id].zh}）` : `陀螺手 ${bladerById(id)?.name||id}`;
// Per-run hiding plan: every remaining item gets a random scene (not the start) + spot. Keeps valid entries from the client.
function makeHidePlan(region, state, prev={}) {
  const scenes = (SCENES[region.id]||[]).filter(x=>x.key!==START_SCENE[region.id]);
  const {beysLeft, bladersLeft} = exploreManifest(region, state);
  const plan = {}, used = new Set();
  for (const [id, h] of Object.entries(prev||{})) { const sc = sceneByKey(region.id, h?.scene); if ((beysLeft.includes(id)||bladersLeft.includes(id)) && sc && sc.spots[h.spot]) { plan[id] = {scene:h.scene, spot:+h.spot}; used.add(h.scene); } }
  const pool = shuffle(scenes);
  for (const id of shuffle([...beysLeft, ...bladersLeft])) {
    if (plan[id]) continue;
    const sc = pool.find(x=>!used.has(x.key)) || pool[Math.floor(Math.random()*pool.length)];
    if (!sc) continue;
    used.add(sc.key); plan[id] = {scene:sc.key, spot:Math.floor(Math.random()*sc.spots.length)};
  }
  return plan;
}
function bfsPath(region, from, to) {
  if (from===to) return [from];
  const prev = {[from]:null}, q = [from];
  while (q.length) { const k = q.shift(); for (const n of sceneByKey(region.id,k)?.exits||[]) if (!(n in prev)) { prev[n]=k; if (n===to) { const path=[to]; let c=k; while (c) { path.unshift(c); c=prev[c]; } return path; } q.push(n); } }
  return null;
}
function nearestTarget(region, scene, plan) {
  let best = null;
  for (const [id, h] of Object.entries(plan)) { const p = bfsPath(region, scene, h.scene); if (p && (!best || p.length < best.path.length)) best = {id, ...h, path:p}; }
  return best;
}
function awardEvent(id, text='') {
  if (BEYS[id]) return {type:'find_bey', beyId:id, text:clean2(text,60)};
  const b = bladerById(id); return {type:'meet_blader', bladerId:id, line:clean2(text||b?.line||'来一场吧！',50)};
}
function scenePageFor(region, sceneKey, raw={}) {
  const scene = sceneByKey(region.id, sceneKey) || sceneByKey(region.id, START_SCENE[region.id]);
  const renamed = new Map((Array.isArray(raw.hotspots)?raw.hotspots:[]).filter(h=>Number.isInteger(+h?.spot)).map(h=>[+h.spot, h]));
  const hotspots = scene.spots.map((p,i)=>({...p, label:clean2(renamed.get(i)?.label||p.label,6), hint:String(renamed.get(i)?.hint||'').slice(0,120), spot:i}));
  const panels = (Array.isArray(raw.panels)?raw.panels:[]).slice(0,3).map((p,i)=>({...p, x:[.04,.56,.04][i], y:[.04,.04,.8][i]}));
  const page = sanitizePage({title:raw.title||scene.title, panels: panels.length?panels:[{text:`来到了${scene.title}。`, kind:'caption'}], imagePrompt:scene.desc, hotspots, cardId:raw.cardId}, (CARDS.find(c=>c.layer==='geo'&&c.region===region.id)||{}).id);
  page.hotspots = page.hotspots.map((h,i)=>({...h, spot:i}));
  page.sceneKey = scene.key;
  page.exits = scene.exits.map(k=>({key:k, title:sceneByKey(region.id,k)?.title||k}));
  return page;
}
async function exploreStep(body, env) {
  const region = regionById(body.regionId);
  if (!region) return json({error:'unknown region'}, 400);
  if (region.comingSoon) return json({comingSoon:true, page:null, events:[], narration:'这片区域还在准备中哦。'});
  const st = body.state || {}, action = body.action || {type:'enter'};
  const enter = action.type==='enter';
  // 1. Where are we, and where does this action take us (graph-validated)?
  let scene = enter ? START_SCENE[region.id] : (sceneByKey(region.id, st.scene) ? st.scene : START_SCENE[region.id]);
  if (action.type==='move') {
    if (!(sceneByKey(region.id, scene)?.exits||[]).includes(action.to)) return json({error:'not an exit'}, 400);
    scene = action.to;
  }
  const sc = sceneByKey(region.id, scene);
  // 2. Hide plan + award decided in code.
  const plan = makeHidePlan(region, st, enter ? {} : st.hidePlan);
  const since = +st.sinceLast || 0;
  let award = null, forced = false;
  if (action.type==='inspect') { const hit = Object.entries(plan).find(([,h])=>h.scene===scene && h.spot===+action.spot); if (hit) award = hit[0]; }
  if (!award && !enter && since >= PACE_FORCE) { const t = nearestTarget(region, scene, plan); if (t) { award = t.id; forced = true; } }
  if (award) delete plan[award];
  const target = nearestTarget(region, scene, plan);
  const {beysLeft, bladersLeft} = exploreManifest(region, st);
  const leftAfter = beysLeft.length + bladersLeft.length - (award ? 1 : 0);
  const geo = CARDS.filter(c=>c.layer==='geo' && c.region===region.id);
  const proto = prototypeOf(region.id);
  const noGate = enter || action.type==='answer' || !!award || (+st.sinceGate||0) < 3;
  // 3. Ask the GM to write it.
  let actionText;
  if (enter) actionText = `孩子刚进入${region.name}（第 ${(+st.runs||0)+1} 次探险），站在「${sc.title}」。介绍这里，并给出第一个线索。`;
  else if (action.type==='move') actionText = `孩子从「${sceneByKey(region.id, st.scene)?.title||''}」走到了「${sc.title}」。描写到达时看到的景象。`;
  else if (action.type==='inspect') { const h = (action.page?.hotspots||[])[+action.spot] || sc.spots[+action.spot] || {}; actionText = `孩子仔细查看了「${sc.title}」里的「${h.label||sc.spots[+action.spot]?.label||'某处'}」。描写他在那里发现了什么。`; }
  else if (action.type==='answer') { const g = st.pendingGate || {}; const ok = String(action.quizId)===String(g.quizId) && +action.choice===+g.answer; actionText = ok ? `孩子答对了关卡题「${g.q||''}」！热烈表扬，告诉他前进的方向。` : `孩子答错了关卡题「${g.q||''}」。温柔地说出正确答案（${g.explain||''}），然后鼓励他继续。`; }
  else actionText = `孩子做了选择：${String(action.label||action.id||'').slice(0,40)}。`;
  const awardText = award ? `【这一步的收获（系统已决定，必须写进画面和文字）】孩子${forced?'在这里':'在这个地方'}${BEYS[award]?'找到了':'遇见了'}${itemLabel(award)}${forced?'（它恰好出现在这里）':''}。` : '这一步没有收获，不要写找到陀螺或遇见陀螺手。';
  const clueText = target ? `下一个藏东西的地方：「${sceneByKey(region.id,target.scene)?.title}」里的「${sceneByKey(region.id,target.scene)?.spots[target.spot]?.label}」，从这里的路线：${target.path.map(k=>sceneByKey(region.id,k)?.title).join(' → ')}。线索要用路标/方向/地形暗示这条路（不要直接说答案，可以说“往灯塔那边”“潮水退了才看得到”）。` : '东西都找齐了，写一个圆满的结尾。';
  const user = `地区：${region.name}（${region.landform}）。当前场景：「${sc.title}」——${sc.desc}
这里可以查看的东西（spot 序号=名字）：${sc.spots.map((p,i)=>i+'='+p.label).join('，')}
从这里可以走到：${sc.exits.map(k=>sceneByKey(region.id,k)?.title).join('、')}
本步：${actionText}
${awardText}
${clueText}
真实地理话题：${region.geoTopics.join('；')}
${proto ? `真实原型：${proto.name}（${proto.place}），提到真实地点时只能用这些事实：\n${proto.facts.map(f=>'- '+f).join('\n')}` : ''}
你的记忆：${String(st.gm||'').slice(0,500) || '（新的冒险）'}
最近的页面：${(Array.isArray(st.trail)?st.trail.slice(-5):[]).join(' → ') || '（无）'}
地理知识卡（geo_fact / gate 只能用这些 id）：
${cardLines(geo)}
规则：中文短句，热血冒险漫画风，给 10 岁孩子看；panels 2~3 个，每个≤40字；涉及真实危险（雷电、涨潮、冰川）要说出正确的安全做法。events 只可以用：clue（线索）${noGate?'':'、gate（关卡：只给 cardId 和一句 lead，题目由系统出）'}、geo_fact（cardId，顺手讲和画面有关的真实地理知识）。可以给 spot 改一个更有趣的名字（hotspots 里写 spot 序号）。
只输出 JSON：{"page":{"title":"≤10字","panels":[{"text":"…","kind":"caption"},{"text":"…","kind":"bubble"}],"hotspots":[{"spot":0,"label":"≤6字","hint":"一句好奇的问题"}],"cardId":"geo-…"},"events":[{"type":"clue","text":"…"}],"gmMemory":"≤300字：走过哪里、给过哪些线索","narration":"博士的一句话≤30字","line":"${award&&!BEYS[award]?'这位陀螺手见面时说的一句话≤20字':''}"}`;
  const finish = (page, gmEvents, gmMemory, narration, extra={}) => {
    const events = [];
    if (award) events.push(awardEvent(award, extra.line || (BEYS[award] ? (page.panels[0]?.text||'') : '')));
    for (const e of Array.isArray(gmEvents) ? gmEvents.slice(0,4) : []) {
      if (e?.type==='clue' && e.text && !events.some(x=>x.type==='clue')) events.push({type:'clue', text:clean2(e.text,70)});
      else if (e?.type==='gate' && !noGate && GATE_BANK[e.cardId] && !events.some(x=>x.type==='gate')) events.push(bankGate(e.cardId, `${e.cardId}-${(+st.steps||0)+1}`, clean2(e.lead||'',40)));
      else if (e?.type==='geo_fact' && getCard(e.cardId)?.layer==='geo' && !events.some(x=>x.type==='geo_fact')) events.push({type:'geo_fact', cardId:e.cardId});
    }
    if (award && leftAfter===0) events.push({type:'complete'});
    return json({page, events, awarded:!!award, scene, hidePlan:plan, gmMemory:String(gmMemory||st.gm||'').slice(0,600), narration:clip(String(narration||''),40), ...extra.meta});
  };
  try {
    const out = await llm(env, {system:FLIP_SYSTEM.replace('一本可以点来点去的漫画科学绘本','一场可以点来点去的漫画冒险（你是 Game Master，同时是融合博士）'), user, maxTokens:700, kind:'explore'});
    return finish(scenePageFor(region, scene, out.page||{}), out.events, out.gmMemory, out.narration, {line:out.line, meta:{via:out.__via, aiNote:out.__note||undefined}});
  } catch (e) {
    const page = scenePageFor(region, scene, {title:sc.title, panels:[{text: award ? `看！${itemLabel(award)}就在这里！` : (enter ? `欢迎来到${region.name}！到处看看，找找藏起来的陀螺吧。` : `来到了${sc.title}，仔细看看这里有什么。`), kind:'caption'}]});
    const clue = target ? [{type:'clue', text:`博士的雷达显示：往「${sceneByKey(region.id,target.path[1]||target.scene)?.title}」那边走走看。`}] : [];
    return finish(page, clue, st.gm, '往前走走看！', {meta:{fallback:true, error:String(e.message||e).slice(0,160)}});
  }
}

async function ask(body, env) {
  const question = String(body.question||'').slice(0,200);
  if (!question) return json({error:'empty question'}, 400);
  const cards = relevantCards(question + ' ' + String(body.context||''), 5);
  const ground = cards.length ? cards : [getCard('bx-three-parts'), getCard('ph-inertia'), getCard('ph-friction-area')];
  const user = `小朋友问：“${question}”
${body.context ? '当前场景：'+String(body.context).slice(0,200) : ''}
参考知识卡：
${cardLines(ground)}
用 2~3 个短句回答（≤80字），优先依据知识卡；不确定就说“我也不确定，我们可以做个实验试试”。如果涉及游戏对战结果，说明只是游戏里的理想化模型。
只输出 JSON：{"answer":"回答","cards":["引用的卡片id"]}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是陀螺王国的融合博士，回答小学生关于陀螺和科学的问题。中文，短句，准确，有趣。只输出 JSON。'}, {role:'user', content:user}], 600, 'ask');
    if (!out.answer) throw new Error('no answer');
    const ids = (Array.isArray(out.cards)?out.cards:[]).filter(id=>getCard(id)).slice(0,2);
    return json({via:out.__via, aiNote:out.__note||undefined, answer:String(out.answer).slice(0,140), cards:ids.map(id=>{const c=getCard(id);return {id,title:c.title,body:c.body,layer:c.layer};})});
  } catch (e) {
    return json({...templateAsk(question), error:String(e.message||e)});
  }
}

export async function handle(request, env) {
  const path = new URL(request.url).pathname;
  // GET /api/ai/providers — live check of the Claude path (e.g. after loading AI Gateway credits).
  if (request.method==='GET' && path.endsWith('/providers')) {
    const t = Date.now(); let claude;
    try { const text = await callCfClaude(env, {system:'Reply with JSON only.', user:'{"ok":true}', maxTokens:20, model:modelFor(env,'ask')}, 12000); claude = {ok:true, sample:text.slice(0,80)}; }
    catch (e) { claude = {ok:false, error:String(e.message||e).slice(0,300)}; }
    return json({smart:modelFor(env,'fusion'), fast:modelFor(env,'ask'), gateway:env?.AI_GATEWAY_ID || 'default', claude, ms:Date.now()-t, workersAI:Boolean(env?.AI), extras:{vercel:Boolean(env?.AI_GATEWAY_API_KEY), anthropic:Boolean(env?.ANTHROPIC_API_KEY)}});
  }
  if (request.method!=='POST') return json({error:'POST only'}, 405);
  let body; try { body = await request.json(); } catch { return json({error:'bad json'}, 400); }
  if (!env?.AI && !hasClaude(env)) {
    // No provider (e.g. plain local dev): answer with templates so the game still works.
    if (path.endsWith('/fusion/chat')) return json(templateFusion({parents:body.parents||[], wish:body.wish, history:body.history, keepParent:body.keepParent}));
    if (path.endsWith('/commentary')) return json(templateCommentary(body.summary||{}, body.names));
    if (path.endsWith('/ask')) return json(templateAsk(body.question));
    if (path.endsWith('/moments')) return json(templateMoments(body.summary||{}, body.moments||[], body.names));
    if (path.endsWith('/experiment')) return json(templateExperiment(body));
    if (path.endsWith('/sketch')) return json({needKey:true, error:'需要家长开启高级 AI'}, 503);
    if (path.endsWith('/flip/start')) return json({page:templateFlipPage({cardId:body.cardId, topic:body.topic}), fallback:true});
    if (path.endsWith('/flip/tap')) return json({page:templateFlipTap(body.page||{}, body.x, body.y), fallback:true});
    if (path.endsWith('/flip/image')) return json({error:'no image model'}, 503);
  }
  if (path.endsWith('/fusion/chat')) return fusionChat(body, env);
  if (path.endsWith('/commentary')) return commentary(body, env);
  if (path.endsWith('/ask')) return ask(body, env);
  if (path.endsWith('/moments')) return moments(body, env);
  if (path.endsWith('/experiment')) return experiment(body, env);
  if (path.endsWith('/sketch')) return sketch(body, env);
  if (path.endsWith('/flip/start')) return flipStart(body, env);
  if (path.endsWith('/flip/tap')) return flipTap(body, env);
  if (path.endsWith('/flip/image')) return flipImage(body, env);
  if (path.endsWith('/explore/step')) return exploreStep(body, env);
  return json({error:'not found'}, 404);
}
export {CARDS};
