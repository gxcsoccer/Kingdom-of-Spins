// AI routes. Mounted by worker/index.js under /api/ai/*.
// Provider order: Vercel AI Gateway (AI_GATEWAY_API_KEY, Anthropic Messages endpoint) → Anthropic API
// (ANTHROPIC_API_KEY) → Workers AI (env.AI). Each step falls back to the next on error.
import Anthropic from '@anthropic-ai/sdk';
// Every route returns a deterministic template fallback when the model fails or times out.
import {sanitizeCandidate, templateFusion, templateCommentary, templateAsk, fusionName, keptParts, needsClarify, STYLE_ZH, CLARIFY, fmtT, fmtRpm, fmtV, tidyNumbers, suggestTryNext, variableFacts, ownName, templateMoments, templateMoment, momentCard, designTakeaway, templateExperiment, experimentVerdict, variableCard} from '../src/ai/fallback.js';
import {CARDS, getCard, relevantCards} from '../src/knowledge/cards.js';
import {TIPS} from '../src/physics/model.js';

export const MODEL = globalThis.process?.env?.AI_MODEL || '@cf/openai/gpt-oss-120b';
const TIMEOUT_MS = {fusion:20000, commentary:14000, ask:10000, moments:12000, experiment:12000, sketch:25000};
export const CLAUDE_MODEL = 'claude-sonnet-5-5';
export const GATEWAY_URL = 'https://ai-gateway.vercel.sh';
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export function contentOf(r) {
  if (r==null) return '';
  if (typeof r==='string') return r;
  if (typeof r.response==='string') return r.response;
  const c = r.choices?.[0]?.message?.content ?? r.result?.choices?.[0]?.message?.content ?? r.result?.response;
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
const withTimeout = (p, ms) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]);

// Claude via the official SDK. Gateway uses the same Messages API with a different base URL + model id.
function claudeClient(env) {
  if (env?.AI_GATEWAY_API_KEY) return {client:new Anthropic({apiKey:env.AI_GATEWAY_API_KEY, baseURL:GATEWAY_URL, maxRetries:0}), model:`anthropic/${CLAUDE_MODEL}`, via:'gateway'};
  if (env?.ANTHROPIC_API_KEY) return {client:new Anthropic({apiKey:env.ANTHROPIC_API_KEY, maxRetries:0}), model:CLAUDE_MODEL, via:'anthropic'};
  return null;
}
export const hasClaude = env => Boolean(env?.AI_GATEWAY_API_KEY || env?.ANTHROPIC_API_KEY);
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
async function callWorkersAI(env, {system, user, maxTokens}, ms) {
  if (!env?.AI) throw new Error('no Workers AI binding');
  const r = await withTimeout(env.AI.run(MODEL, {messages:[{role:'system', content:system}, {role:'user', content:user}], max_tokens:maxTokens, reasoning_effort:'low'}), ms);
  return contentOf(r);
}
// One helper for every route. Returns parsed JSON (json:true) or text. Throws only if every provider failed.
export async function llm(env, {system, user, images=[], maxTokens=800, json:wantJson=true, kind='fusion', claudeOnly=false}) {
  const ms = TIMEOUT_MS[kind] || 12000, errors = [];
  const c = claudeClient(env);
  if (c) {
    try {
      const text = await withTimeout(callClaude(c, {system, user, images, maxTokens}, ms), ms);
      const out = wantJson ? parseJSON(text) : text;
      if (out) return out;
      errors.push(`${c.via}: unparseable`);
    } catch (e) { errors.push(`${c.via}: ${e.message||e}`); }
  }
  if (claudeOnly) throw new Error(errors.join('; ') || 'no Claude key');
  try {
    const text = await callWorkersAI(env, {system, user, maxTokens: maxTokens+300}, ms);   // + room for gpt-oss reasoning tokens
    const out = wantJson ? parseJSON(text) : text;
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
      return json({reply:String(out.reply||CLARIFY.reply).slice(0,60), question:String(out.question).slice(0,60), options: options.length>=2?options:CLARIFY.options});
    }
    const raw = Array.isArray(out.candidates) ? out.candidates.slice(0,3) : [];
    const candidates = raw.map(c=>sanitizeCandidate(c, parents, keepParent, 'ai'));
    // De-duplicate ids (same params+name) and top up with templates if the model gave too few.
    const seen = new Set(), uniq = candidates.filter(c=>!seen.has(c.id) && seen.add(c.id));
    const names = new Set(); uniq.forEach((c,i)=>{ if (names.has(c.name)) c.name = `${c.name} ${['II','X','Z'][i-1]||i}`; names.add(c.name); });
    if (uniq.length<2) for (const t of templateFusion({parents, wish:allWish, history:[{role:'assistant',question:'x'}], keepParent}).candidates||[]) if (uniq.length<2 && !seen.has(t.id)) { seen.add(t.id); uniq.push(t); }
    return json({reply:String(out.reply||'融合完成！看看这几个方案！').slice(0,60), candidates:uniq});
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
    const story = (Array.isArray(out.story)?out.story:[]).map(s=>tidyNumbers(String(s)).slice(0,64)).filter(Boolean).slice(0,4);
    if (!story.length || !out.headline) throw new Error('incomplete');
    let sciBody = tidyNumbers(String(out.science?.body||card.body)).slice(0,90);
    if (!sciBody.includes('模型')) sciBody += '（在这个模型里）';
    // tryNext must target the player's own bey; otherwise use the deterministic suggestion.
    let tryNext = tidyNumbers(String(out.tryNext||''));
    if (!tryNext || (names[1] && tryNext.includes(names[1]) && !tryNext.includes(names[0])) || !(tryNext.includes(names[0])||tryNext.includes('你的'))) tryNext = hint;
    return json({headline:tidyNumbers(String(out.headline)).slice(0,20), story, science:{cardId:card.id, title:card.title, body:sciBody, layer:card.layer}, tryNext:tryNext.slice(0,60)});
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
    if (d.reason) bits.push(`方式 ${d.reason}`); if (d.winner!=null) bits.push(`胜者 ${who(d.winner)}`);
    return `- id=${m.id} ${fmtT(m.time)} ${m.kind}${m.body!=null?' 主角 '+who(m.body):''}：${bits.join('，')}（建议卡片 ${momentCard(m)}）`;
  };
  const cardIds = [...new Set(list.map(momentCard).concat(['ph-energy-convert','ph-inertia','ph-momentum','ph-tilt-fall']))];
  const r = summary.result || {};
  const cmp = (k, label) => P.length===2 && P[0][k]!=null && P[1][k]!=null && P[0][k]!==P[1][k] ? `${label}更大的是 ${who(P[0][k]>P[1][k]?0:1)}` : null;
  const facts = [cmp('inertiaZ','转动惯量'), cmp('massG','总重'), cmp('ring','外圈配重')].filter(Boolean).join('；');
  const user = `陀螺对战回放的关键时刻（真实模拟数据，理想化物理模型）。
${parts}
对比事实（不得矛盾）：${facts||'无'}
结果：${who(r.winner)} 获胜（${r.reason}）。
关键时刻：
${list.map(line).join('\n')}
知识卡：
${cardIds.map(id=>getCard(id)).filter(Boolean).map(c=>`- ${c.id} ${c.title}：${c.body}`).join('\n')}
为每个时刻写：title（≤10字，热血漫画风，如“龙翼猛撞！”）；explain（≤55字：发生了什么+为什么，用小学生能懂的物理讲；最多引用 1~2 个数字，并照抄上面的格式（如“1.9 m/s”“约 1,300 转”），要解释含义，不要罗列；因果判断说“在这个模型里”，物理原因只能来自知识卡和对比事实）；cardId（从知识卡选）。
玩家的陀螺叫“你的 ${names[0]}”。不要编造上面没有的事件。takeaway 一句话：把结果和“你的 ${names[0]}”的设计选择（配重/轴尖/翼片/高度）联系起来。
只输出 JSON：{"headline":"≤14字","moments":[{"id":"","title":"","explain":"","cardId":""}],"takeaway":"≤50字"}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是热血漫画风的陀螺解说员兼科学老师。中文短句，诚实，只输出 JSON。'}, {role:'user', content:user}], 600, 'moments');
    const got = new Map((Array.isArray(out.moments)?out.moments:[]).map(m=>[String(m.id), m]));
    const merged = list.map(m=>{
      const t = templateMoment(m, names), o = got.get(String(m.id));
      if (!o) return t;
      return {id:m.id, title:tidyNumbers(String(o.title||t.title)).slice(0,12), explain:ownName(tidyNumbers(String(o.explain||t.explain)), names[0]).slice(0,90), cardId:getCard(o.cardId)?o.cardId:t.cardId};
    });
    let takeaway = ownName(tidyNumbers(String(out.takeaway||'')), names[0]).slice(0,70);
    if (!takeaway || !takeaway.includes('你的')) takeaway = designTakeaway(summary, names);
    return json({headline:String(out.headline||fallback().headline).slice(0,16), moments:merged, takeaway});
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
    const out = await runModel(env, [{role:'system', content:'你是陀螺王国的科学老师，带小学生做实验。中文短句，鼓励，诚实，只输出 JSON。'}, {role:'user', content:user}], 450, 'experiment');
    const pick = (k, max) => { const v = ownName(tidyNumbers(String(out[k]||'')).trim(), names[0]); return (v || base[k]).slice(0, max); };
    let conclusion = pick('conclusion', 80);
    if (!conclusion.includes('模型')) conclusion = conclusion.replace(/。?$/, '（在这个模型里）。');
    return json({verdict:base.verdict, conclusion, why:pick('why',110), repeatLesson:pick('repeatLesson',70), predictionFeedback:pick('predictionFeedback',50), cardId:base.cardId, nextIdea:pick('nextIdea',50)});
  } catch (e) {
    return json({...base, error:String(e.message||e)});
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
    return json({answer:String(out.answer).slice(0,140), cards:ids.map(id=>{const c=getCard(id);return {id,title:c.title,body:c.body,layer:c.layer};})});
  } catch (e) {
    return json({...templateAsk(question), error:String(e.message||e)});
  }
}

export async function handle(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method!=='POST') return json({error:'POST only'}, 405);
  let body; try { body = await request.json(); } catch { return json({error:'bad json'}, 400); }
  if (!env?.AI && !hasClaude(env)) {
    // No provider (e.g. plain local dev): answer with templates so the game still works.
    if (path.endsWith('/fusion/chat')) return json(templateFusion({parents:body.parents||[], wish:body.wish, history:body.history, keepParent:body.keepParent}));
    if (path.endsWith('/commentary')) return json(templateCommentary(body.summary||{}, body.names));
    if (path.endsWith('/ask')) return json(templateAsk(body.question));
    if (path.endsWith('/moments')) return json(templateMoments(body.summary||{}, body.moments||[], body.names));
    if (path.endsWith('/experiment')) return json(templateExperiment(body));
  }
  if (path.endsWith('/fusion/chat')) return fusionChat(body, env);
  if (path.endsWith('/commentary')) return commentary(body, env);
  if (path.endsWith('/ask')) return ask(body, env);
  if (path.endsWith('/moments')) return moments(body, env);
  if (path.endsWith('/experiment')) return experiment(body, env);
  return json({error:'not found'}, 404);
}
export {CARDS};
