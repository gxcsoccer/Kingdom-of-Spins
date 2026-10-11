// Browser client for /api/ai/*. Never throws: on network error/timeout it returns the same
// deterministic template the worker would, flagged with `fallback: true`.
import {templateFusion, templateCommentary, templateAsk} from './fallback.js';

async function post(path, body, ms) {
  const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), ms);
  try {
    const r = await fetch(path, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:ctl.signal});
    if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// → {reply, question?, options?, candidates?: [Bey], fallback?}
export async function fusionChat({parents, wish='', history=[], keepParent=0}) {
  try {
    const out = await post('/api/ai/fusion/chat', {parents, wish, history, keepParent}, 22000);
    if (out?.question || out?.candidates?.length) return out;
    throw new Error('empty');
  } catch { return templateFusion({parents, wish, history, keepParent}); }
}

// summary = Battle.summary(); names = [nameA, nameB]
// → {headline, story:[...], science:{cardId,title,body}, tryNext, fallback?}
export async function commentary(summary, names=['A','B']) {
  try {
    const out = await post('/api/ai/commentary', {summary, names}, 16000);
    if (out?.headline) return out;
    throw new Error('empty');
  } catch { return templateCommentary(summary, names); }
}

// → {answer, cards:[{id,title,body,layer}], fallback?}
export async function ask(question, context='') {
  try {
    const out = await post('/api/ai/ask', {question, context}, 12000);
    if (out?.answer) return out;
    throw new Error('empty');
  } catch { return templateAsk(question); }
}
