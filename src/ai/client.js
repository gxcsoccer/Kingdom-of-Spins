// Browser client for /api/ai/*. Never throws: on network error/timeout it returns the same
// deterministic template the worker would, flagged with `fallback: true`.
import {templateFusion, templateCommentary, templateAsk, templateMoments, templateExperiment} from './fallback.js';

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

// moments: [{id,time,kind,body?,data}] computed from real battle data
// → {headline, moments:[{id,title,explain,cardId}], takeaway, fallback?}
export async function explainMoments(summary, moments, names=['A','B']) {
  try {
    const out = await post('/api/ai/moments', {summary, moments, names}, 13000);
    if (out?.moments?.length || out?.headline) return out;
    throw new Error('empty');
  } catch { return templateMoments(summary, moments, names); }
}

// input: {names, variable:{key,label,from,to}, prediction:'more'|'less'|'same'|null, metric, stats:{A,B}, trials}
// → {verdict:'B更好'|'A更好'|'差不多', conclusion, why, repeatLesson, predictionFeedback, cardId, nextIdea, fallback?}
export async function explainExperiment(input) {
  try {
    const out = await post('/api/ai/experiment', input, 13000);
    if (out?.verdict && out?.conclusion) return out;
    throw new Error('empty');
  } catch { return templateExperiment(input); }
}

// Names the game screens call: aiClient.moments({...}) / ai.experiment(payload).
export const moments = ({summary, moments: list, names}) => explainMoments(summary, list, names);
export const experiment = payload => explainExperiment(payload);

// Kid's drawing/photo → {bey} | {needKey:true} | {error}. Claude-only on the server.
export async function sketch({imageDataUrl, wish='', keepParts=null}) {
  const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), 30000);
  try {
    const r = await fetch('/api/ai/sketch', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({imageDataUrl, wish, keepParts}), signal:ctl.signal});
    const out = await r.json().catch(()=>({}));
    if (r.status===503 || out.needKey) return {needKey:true};
    if (!r.ok || !out.bey) return {error: out.error || ('HTTP '+r.status)};
    return out;
  } catch (e) { return {error: e.name==='AbortError' ? 'timeout' : String(e.message||e)}; }
  finally { clearTimeout(timer); }
}

// Downscale an image File to a ≤maxSide JPEG data URL (keeps uploads small for the vision call).
export async function fileToDataUrl(file, maxSide=1024, quality=.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const k = Math.min(1, maxSide/Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}
