// Flipbook API client. Never throws for page JSON (template fallback); image may resolve to null.
import {templateFlipPage, templateFlipTap, templateFlipBranch, branchCardFor} from '../ai/fallback.js';

async function post(path, body, ms) {
  const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), ms);
  try {
    const r = await fetch(path, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:ctl.signal});
    const out = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(out.error || 'HTTP '+r.status);
    return out;
  } finally { clearTimeout(timer); }
}
// start = {topic?, cardId?, bey?, moment?} → page
export async function flipStart(start={}) {
  try { const out = await post('/api/ai/flip/start', start, 36000); if (out.page) return out.page; throw new Error('empty'); }
  catch { return templateFlipPage({cardId:start.cardId, topic:start.topic}); }
}
// Curiosity branch: chapter = {id, title, question, cards}; exclude = cards already used by the branch above. → {page}
export async function flipTap({chapter, page, imageDataUrl, x, y, spots=[], exclude=[]}) {
  try { const out = await post('/api/ai/flip/tap', {chapter, page, imageDataUrl, x, y, spots, exclude}, 36000); if (out.page) return {page:out.page}; throw new Error('empty'); }
  catch {
    const pool = chapter.cards.filter(id=>!exclude.includes(id));
    const near = spots.map(sp=>({...sp, d:Math.hypot(sp.x-x, sp.y-y)})).sort((a,b)=>a.d-b.d)[0];
    const label = near && near.d < .15 ? near.label : '';
    const cardId = label ? (pool.includes(near.cardId) ? near.cardId : branchCardFor(label, pool)) : null;
    return {page:templateFlipBranch({chapter, tapped:label||'这里', cardId, offTopic:!cardId})};
  }
}
// → {page, tapped}
export async function flipTapFree({page, imageDataUrl, x, y, trail}) {
  try { const out = await post('/api/ai/flip/tap', {page, imageDataUrl, x, y, trail}, 36000); if (out.page) return {page:out.page, tapped:out.tapped}; throw new Error('empty'); }
  catch { return {page:templateFlipTap(page, x, y), tapped:''}; }
}
const imageCache = new Map();   // prompt → Promise<dataUrl|null>
const fetchImage = prompt => post('/api/ai/flip/image', {prompt}, 42000).then(o=>{ if (!o.image) throw new Error('no image'); return o.image; });
export function flipImage(prompt) {
  if (!prompt) return Promise.resolve(null);
  if (!imageCache.has(prompt)) imageCache.set(prompt, fetchImage(prompt).catch(()=>fetchImage(prompt)).catch(()=>{ imageCache.delete(prompt); return null; }));   // one retry
  return imageCache.get(prompt);
}
// Dedupe identical start requests (React StrictMode double-mount, quick reopen).
const startCache = new Map();
export function flipStartOnce(start={}) {
  const k = JSON.stringify(start);
  if (!startCache.has(k)) { startCache.set(k, flipStart(start)); setTimeout(()=>startCache.delete(k), 30000); }
  return startCache.get(k);
}
// Draw the page image with a red tap circle, downscaled to ≤maxSide, as a JPEG data URL for Claude vision.
export async function markTap(imageUrl, x, y, maxSide=768) {
  if (!imageUrl) return null;
  const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=imageUrl; });
  const k = Math.min(1, maxSide/Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
  g.strokeStyle = '#ff1a1a'; g.lineWidth = Math.max(4, c.width*.008);
  g.beginPath(); g.arc(x*c.width, y*c.height, c.width*.055, 0, Math.PI*2); g.stroke();
  return c.toDataURL('image/jpeg', .82);
}
