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
