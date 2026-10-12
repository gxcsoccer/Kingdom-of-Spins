import {normalizeLocale, limitText} from '../src/i18n/index.js';
import {ttsPayload} from '../src/game/voiceProfiles.js';
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
// Fish narration and character voices; the frontend removes child nicknames before synthesis.
// 防滥用：只接受本站页面发来的 JSON（跨站“简单请求”和别的网站都会被拒），并按 IP 限频。
// 缓存：workers.dev 上 caches.default 不生效，所以真正的“同一句不重复合成”在浏览器端（voiceClips.js）。
const ttsHits = new Map();   // ip -> [timestamps]（单个 isolate 内的尽力限频）
function ttsAllowed(request) {
  const url = new URL(request.url), origin = request.headers.get('Origin'), site = request.headers.get('Sec-Fetch-Site');
  if (!/application\/json/i.test(request.headers.get('Content-Type') || '')) return false;
  if (origin && origin !== url.origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return false;   // 本地开发经 vite 代理
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'local', now = Date.now();
  const recent = (ttsHits.get(ip) || []).filter(t => now - t < 60_000);
  if (recent.length >= 40) return false;   // 每分钟 40 句，够一场复盘
  recent.push(now); ttsHits.set(ip, recent);
  if (ttsHits.size > 5000) ttsHits.clear();
  return true;
}
export async function tts(request, env, ctx) {
  if (!env.FISH_API_KEY) return json({error: 'tts not configured'}, 503);
  if (!ttsAllowed(request)) return json({error: 'forbidden'}, 429);
  let body; try { body = await request.json(); } catch { return json({error: 'bad json'}, 400); }
  if (!body || typeof body !== 'object') return json({error: 'bad body'}, 400);
  const locale = normalizeLocale(body.locale);
  const text = limitText(String(body.text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim(), 400);   // 揭晓答案的长句也能完整读完
  if (!text) return json({error: 'empty'}, 400);
  const payload = ttsPayload(text, String(body.voice), locale, env);
  // English falls back to the device's English voice until an English Fish voice is configured.
  if (!payload) return json({error:'English voice not configured'}, 503);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(locale + '|' + JSON.stringify(payload))))].map(b => b.toString(16).padStart(2, '0')).join('');
  const cacheKey = new Request(`https://tts.cache/${digest}.mp3`);
  const cache = caches.default, hit = await cache.match(cacheKey);
  if (hit) return hit;
  const r = await fetch('https://api.fish.audio/v1/tts', {method: 'POST', headers: {Authorization: `Bearer ${env.FISH_API_KEY}`, 'Content-Type': 'application/json', model: 's2.1-pro-free'},
    body: JSON.stringify(payload)});
  if (!r.ok) return json({error: 'tts upstream ' + r.status}, 502);
  const res = new Response(await r.arrayBuffer(), {headers: {'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800'}});
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
