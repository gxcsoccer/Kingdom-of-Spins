// Kingdom of Spins — Cloudflare Worker: /api/* routes, PvP rooms (/ws/room/:code), static SPA from ./dist.
import * as ai from './ai.js';
import {BattleRoom, ROOM_ALPHABET} from './room.js';
export {BattleRoom};

const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
const CODE_RE = new RegExp(`^[${ROOM_ALPHABET}]{5}$`);

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, b => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/api/health') return json({ok: true, service: 'kingdom-of-spins', ai: Boolean(env.AI), rooms: Boolean(env.ROOMS), time: new Date().toISOString()});
      if (path === '/api/tts' && request.method === 'POST') return await tts(request, env, ctx);
      if (path.startsWith('/api/ai/')) return await ai.handle(request, env, ctx);

      if (path === '/api/rooms' && request.method === 'POST') {
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = newCode();
          const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(`https://room/init?code=${code}`, {method: 'POST'});
          if (res.ok) return json({code});
        }
        return json({error: 'could not allocate room'}, 503);
      }
      const ws = path.match(/^\/ws\/room\/([A-Za-z0-9]+)$/);
      if (ws) {
        const code = ws[1].toUpperCase();
        if (!CODE_RE.test(code)) return json({error: 'bad room code'}, 400);
        if (request.headers.get('Upgrade') !== 'websocket') return json({error: 'expected websocket'}, 426);
        return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
      }
      if (path.startsWith('/api/')) return json({error: 'not found'}, 404);
      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({error: String(e?.message || e)}, 500);
    }
  },
};

// 博士实时配音（Fish Audio，老爷爷声线）：只合成游戏/AI 生成的博士台词；前端发送前已去掉孩子昵称。
// 防滥用：只接受本站页面发来的 JSON（跨站“简单请求”和别的网站都会被拒），并按 IP 限频。
// 缓存：workers.dev 上 caches.default 不生效，所以真正的“同一句不重复合成”在浏览器端（voiceClips.js）。
const VOICES = {doctor: 'ee18d36ee7bc4ab09f0533fa1e8e1ed0'};
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
async function tts(request, env, ctx) {
  if (!env.FISH_API_KEY) return json({error: 'tts not configured'}, 503);
  if (!ttsAllowed(request)) return json({error: 'forbidden'}, 429);
  let body; try { body = await request.json(); } catch { return json({error: 'bad json'}, 400); }
  if (!body || typeof body !== 'object') return json({error: 'bad body'}, 400);
  const text = String(body.text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 400);   // 揭晓答案的长句也能完整读完
  if (!text) return json({error: 'empty'}, 400);
  const voice = Object.hasOwn(VOICES, String(body.voice)) ? VOICES[body.voice] : VOICES.doctor;
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(voice + '|' + text)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const cacheKey = new Request(`https://tts.cache/${digest}.mp3`);
  const cache = caches.default, hit = await cache.match(cacheKey);
  if (hit) return hit;
  const r = await fetch('https://api.fish.audio/v1/tts', {method: 'POST', headers: {Authorization: `Bearer ${env.FISH_API_KEY}`, 'Content-Type': 'application/json', model: 's2.1-pro-free'},
    body: JSON.stringify({text, format: 'mp3', mp3_bitrate: 64, reference_id: voice})});
  if (!r.ok) return json({error: 'tts upstream ' + r.status}, 502);
  const res = new Response(await r.arrayBuffer(), {headers: {'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800'}});
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
