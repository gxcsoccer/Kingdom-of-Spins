// AI routes (Workers AI). Mounted by worker/index.js under /api/ai/*.
// Every route returns a deterministic template fallback when the model fails or times out.
import {sanitizeCandidate, templateFusion, templateCommentary, templateAsk, fusionName, keptParts, needsClarify, STYLE_ZH, CLARIFY} from '../src/ai/fallback.js';
import {CARDS, getCard, relevantCards} from '../src/knowledge/cards.js';
import {TIPS} from '../src/physics/model.js';

export const MODEL = globalThis.process?.env?.AI_MODEL || '@cf/openai/gpt-oss-120b';
const TIMEOUT_MS = {fusion:20000, commentary:14000, ask:10000};
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
async function runModel(env, messages, maxTokens=1400, kind='fusion') {
  const call = env.AI.run(MODEL, {messages, max_tokens:maxTokens, reasoning_effort:'low'});
  const timer = new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), TIMEOUT_MS[kind]));
  const r = await Promise.race([call, timer]);
  const out = parseJSON(contentOf(r));
  if (!out) throw new Error('unparseable model output');
  return out;
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
  const ev = (summary.events||[]).filter(e=>e.type!=='dash').slice(0,25).map(e=>e.type==='collision'
    ? `${e.time}s 碰撞 相对速度${e.relSpeed}m/s 撞后转速 ${names[0]}=${e.rpm?.[0]} ${names[1]}=${e.rpm?.[1]}rpm`
    : `${e.time}s ${e.type}${e.reason?' '+e.reason:''}${e.winner!=null?' 胜者'+names[e.winner]:''}`);
  const dashes = (summary.events||[]).filter(e=>e.type==='dash').length;
  const parts = (summary.parts||[]).map((p,i)=>`${names[i]}：${STYLE_ZH[p.style]||p.style}，翼${p.wings}，外圈配重${p.ring}%，总重${p.massG}g，Bit ${p.tip}，Ratchet高${p.height}，转动惯量Iz=${(p.inertiaZ*1e6).toFixed(2)}×10⁻⁶ kg·m²`).join('\n');
  const stats = (summary.stats||[]).map((s,i)=>`${names[i]}：碰撞${s.hits}次，最高速度${(s.maxSpeed||0).toFixed(2)}m/s`).join('；');
  const r = summary.result||{};
  const P = summary.parts||[];
  const cmp = (k, label, unit='') => P.length===2 && P[0][k]!=null && P[1][k]!=null ? (P[0][k]===P[1][k] ? `${label}一样` : `${label}更大的是 ${names[P[0][k]>P[1][k]?0:1]}（${P[0][k]}${unit} vs ${P[1][k]}${unit}）`) : null;
  const facts = [cmp('inertiaZ','转动惯量 Iz'), cmp('massG','总重','g'), cmp('ring','外圈配重','%'), cmp('reach','刃半径','m')].filter(Boolean).join('；');
  const cards = relevantCards(`${r.reason} 撞 碰撞 持久 惯量 摩擦 ${(summary.parts||[]).map(p=>p.style+' '+p.tip).join(' ')}`, 8);
  const user = `一场陀螺对战刚结束（理想化物理模型模拟，未经实物校准）。
陀螺：
${parts}
事件：${ev.join('；') || '无碰撞'}；X Dash 冲刺 ${dashes} 次。
统计：${stats}
计算好的对比事实（不得与之矛盾）：${facts||'无'}
结果：${names[r.winner]||'?'} 获胜，方式 ${r.reason}（xtreme=Xtreme终结3分，over=出界2分，spin=停转1分，judge=时间到按转速判定1分），${r.points}分，用时 ${r.time}s。
可引用的知识卡：
${cardLines(cards)}
请像热血漫画解说员一样给小学生复盘。只能引用上面真实发生的时间和转速数字，不要编造事件。“撞后转速”只是撞完那一刻的数值，不要说成上升或下降，除非两次数值能比较。科学解释必须和“对比事实”一致。做因果判断时说“在这个模型里”。
只输出 JSON：{"headline":"≤16字标题","story":["3~4个短句，每句带真实时间或数字"],"science":{"cardId":"卡片id","title":"标题","body":"结合这场比赛讲这个知识，≤60字"},"tryNext":"建议只改一个变量再比一次，≤40字"}`;
  try {
    const out = await runModel(env, [{role:'system', content:'你是陀螺对战的热血解说员兼科学老师。中文，短句，有趣，诚实。只输出 JSON。'}, {role:'user', content:user}], 900, 'commentary');
    const card = getCard(out.science?.cardId) || getCard(fallback().science.cardId);
    const story = (Array.isArray(out.story)?out.story:[]).map(s=>String(s).slice(0,60)).filter(Boolean).slice(0,4);
    if (!story.length || !out.headline) throw new Error('incomplete');
    let sciBody = String(out.science?.body||card.body).slice(0,90);
    if (!sciBody.includes('模型')) sciBody += '（在这个模型里）';
    return json({headline:String(out.headline).slice(0,20), story, science:{cardId:card.id, title:String(out.science?.title||card.title).slice(0,16), body:sciBody, layer:card.layer}, tryNext:String(out.tryNext||fallback().tryNext).slice(0,60)});
  } catch (e) {
    return json({...fallback(), error:String(e.message||e)});
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
  if (!env?.AI) {
    // No binding (e.g. plain local dev): answer with templates so the game still works.
    if (path.endsWith('/fusion/chat')) return json(templateFusion({parents:body.parents||[], wish:body.wish, history:body.history, keepParent:body.keepParent}));
    if (path.endsWith('/commentary')) return json(templateCommentary(body.summary||{}, body.names));
    if (path.endsWith('/ask')) return json(templateAsk(body.question));
  }
  if (path.endsWith('/fusion/chat')) return fusionChat(body, env);
  if (path.endsWith('/commentary')) return commentary(body, env);
  if (path.endsWith('/ask')) return ask(body, env);
  return json({error:'not found'}, 404);
}
export {CARDS};
