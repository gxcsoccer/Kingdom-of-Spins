// BattleRoom Durable Object: one invite room, two players, best of 5 (first to 3 round wins).
// Physics is deterministic, so the room only coordinates: lock inputs, hand out a seed, compare results.
import {DurableObject} from 'cloudflare:workers';

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const POINTS = {xtreme: 3, over: 2, burst: 2, spin: 1, judge: 1};
export const TARGET = 3;   // 5 局 3 胜: rounds to win
const RESULT_WAIT_MS = 20_000;
const GO_LEAD_MS = 3500, LAUNCH_WINDOW_MS = 10_000, START_LEAD_MS = 1200; // synced round start (arm → go)       // after the first result, wait this long for the other one
const IDLE_EXPIRE_MS = 2 * 3600_000; // empty rooms are wiped after 2 h

const fresh = code => ({code, created: Date.now(), status: 'waiting', players: [], score: [0, 0], round: 1, match: null, last: null, champion: null});

export class BattleRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
  }

  async save() { await this.ctx.storage.put('room', this.room); }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.room) return new Response('taken', {status: 409});
      this.room = fresh(url.searchParams.get('code'));
      await this.save();
      await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRE_MS);
      return new Response('ok');
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', {status: 426});
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    if (!this.room) {
      server.send(JSON.stringify({type: 'error', code: 'no-room', message: '房间不存在或已过期'}));
      server.close(4404, 'no room');
    }
    return new Response(null, {status: 101, webSocket: client});
  }

  // ---- helpers ----
  sockets() { return this.ctx.getWebSockets(); }
  slotOf(ws) { const a = ws.deserializeAttachment(); return a ? a.slot : -1; }
  connectedSlots() { return new Set(this.sockets().map(ws => this.slotOf(ws)).filter(s => s >= 0)); }
  publicState() {
    const r = this.room, online = this.connectedSlots();
    return {
      code: r.code, status: r.status, score: r.score, round: r.round, target: TARGET, champion: r.champion, last: r.last,
      players: r.players.map((p, i) => ({slot: i, nickname: p.nickname, bey: p.bey, ready: p.ready, armed: !!p.armed, connected: online.has(i)})),
      go: r.go || null,
      match: r.match ? {matchId: r.match.matchId, round: r.match.round, seed: r.match.seed, beys: r.match.beys, launches: r.match.launches, reported: [0, 1].filter(i => r.match.results[i])} : null,
    };
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) { const s = JSON.stringify(msg); for (const ws of this.sockets()) { try { ws.send(s); } catch {} } }
  broadcastState() { for (const ws of this.sockets()) this.send(ws, {type: 'state', room: this.publicState(), you: this.slotOf(ws)}); }

  // ---- websocket events (hibernation API) ----
  async webSocketMessage(ws, raw) {
    if (!this.room) return;
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return this.send(ws, {type: 'error', message: 'bad json'}); }
    const r = this.room;
    if (msg.type === 'join') return this.onJoin(ws, msg);
    if (msg.type === 'clock') return this.send(ws, {type: 'clock', t: msg.t, now: Date.now()});
    const slot = this.slotOf(ws);
    if (slot < 0) return this.send(ws, {type: 'error', code: 'not-joined', message: '请先加入房间'});
    const me = r.players[slot];

    if (msg.type === 'bey' && r.status === 'waiting') {
      if (msg.bey && typeof msg.bey === 'object') { me.bey = msg.bey; me.ready = false; me.launch = null; }
    } else if (msg.type === 'ready') {
      if (r.status !== 'waiting') return this.send(ws, {type: 'error', code: 'locked', message: '这一回合已经锁定'});
      me.launch = sanitizeLaunch(msg.launch); me.ready = true;
      if (msg.bey && typeof msg.bey === 'object') me.bey = msg.bey;
      if (r.players.length === 2 && r.players.every(p => p.ready && p.bey)) return this.lockAndStart();
    } else if (msg.type === 'arm') {
      // Both kids pressed 准备好了 → everyone plays the countdown from the same server instant.
      if (r.status !== 'waiting' || r.go) return;
      me.armed = true;
      if (r.players.length === 2 && r.players.every(p => p.armed)) {
        const at = Date.now() + GO_LEAD_MS;
        r.go = {round: r.round, at, deadline: at + LAUNCH_WINDOW_MS};
        await this.save();
        this.broadcastState();
        return this.broadcast({type: 'go', ...r.go});
      }
    } else if (msg.type === 'pull') {
      // Live slingshot power: relayed to the other kid only, never stored.
      const power = Math.max(0, Math.min(1, Number(msg.power) || 0));
      for (const other of this.sockets()) if (this.slotOf(other) >= 0 && this.slotOf(other) !== slot) this.send(other, {type: 'pull', slot, power});
      return;
    } else if (msg.type === 'unready' && r.status === 'waiting') {
      me.ready = false;
    } else if (msg.type === 'result') {
      return this.onResult(slot, msg);
    } else if (msg.type === 'rematch' && r.status === 'done') {
      Object.assign(r, {status: 'waiting', score: [0, 0], round: 1, match: null, last: null, champion: null, go: null});
      r.players.forEach(p => { p.ready = false; p.launch = null; p.armed = false; });
    } else if (msg.type === 'leave') {
      return this.onLeave(ws, slot);
    } else {
      return;
    }
    await this.save();
    this.broadcastState();
  }

  async onJoin(ws, msg) {
    const r = this.room;
    const pid = String(msg.pid || '').slice(0, 64);
    if (!pid) return this.send(ws, {type: 'error', code: 'no-pid', message: 'missing pid'});
    let slot = r.players.findIndex(p => p.pid === pid);
    if (slot < 0) {
      if (r.players.length >= 2) { this.send(ws, {type: 'error', code: 'full', message: '房间已满'}); return ws.close(4409, 'full'); }
      r.players.push({pid, nickname: String(msg.nickname || '玩家').slice(0, 24), bey: msg.bey || null, ready: false, launch: null});
      slot = r.players.length - 1;
    } else {
      // Reconnect: drop the stale socket for this slot, keep progress.
      for (const other of this.sockets()) if (other !== ws && this.slotOf(other) === slot) { try { other.close(4000, 'replaced'); } catch {} }
      if (msg.nickname) r.players[slot].nickname = String(msg.nickname).slice(0, 24);
      if (msg.bey && r.status === 'waiting') r.players[slot].bey = msg.bey;
    }
    ws.serializeAttachment({slot, pid});
    await this.save();
    await this.ctx.storage.setAlarm(r.status === 'locked' && r.match?.deadline ? r.match.deadline : Date.now() + IDLE_EXPIRE_MS);
    this.send(ws, {type: 'joined', slot, code: r.code, serverNow: Date.now()});
    this.broadcastState();
    // The final broadcast may have happened while this player was offline.
    // Re-send it so an existing client's round banner can finish on reconnect.
    if (r.last) this.send(ws, {type: 'final', ...r.last, score: r.score, matchOver: r.status === 'done', champion: r.champion});
    // Re-send an in-flight match so a reconnecting client can (re)simulate it.
    if (r.status === 'locked' && r.match) this.send(ws, {type: 'start', ...startPayload(r.match)});
    else if (r.status === 'waiting' && r.go && !r.players[slot]?.ready) this.send(ws, {type: 'go', ...r.go});   // 已经发射过的不再补发，免得被要求重新发射
  }

  async lockAndStart() {
    const r = this.room;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    r.status = 'locked';
    r.match = {matchId: crypto.randomUUID(), round: r.round, seed, beys: r.players.map(p => p.bey), launches: r.players.map(p => p.launch), results: {}, deadline: null, at: Date.now() + START_LEAD_MS};
    r.go = null;
    await this.save();
    this.broadcastState();
    this.broadcast({type: 'start', ...startPayload(r.match)});
  }

  async onResult(slot, msg) {
    const r = this.room, m = r.match;
    if (r.status !== 'locked' || !m || msg.matchId !== m.matchId || m.results[slot]) return; // late/duplicate
    const winner = msg.winner === 0 || msg.winner === 1 ? msg.winner : null;
    if (winner === null || !Object.hasOwn(POINTS, msg.reason)) return this.send(this.sockets().find(w => this.slotOf(w) === slot), {type: 'error', message: 'bad result'});
    m.results[slot] = {winner, reason: msg.reason, time: Number(msg.time) || 0};
    if (m.results[0] && m.results[1]) return this.finalize();
    m.deadline = Date.now() + RESULT_WAIT_MS;
    await this.save();
    await this.ctx.storage.setAlarm(m.deadline);
    this.broadcastState();
  }

  async finalize(timedOut = false) {
    const r = this.room, m = r.match;
    const a = m.results[0], b = m.results[1];
    const chosen = a || b; // host (slot 0) wins disagreements
    const mismatch = Boolean(a && b && (a.winner !== b.winner || a.reason !== b.reason));
    const points = POINTS[chosen.reason];
    r.score[chosen.winner] += 1;   // a won round counts 1 (points kept in `last` for display)
    const matchOver = r.score[chosen.winner] >= TARGET;
    r.last = {matchId: m.matchId, round: m.round, winner: chosen.winner, reason: chosen.reason, points, time: chosen.time, mismatch, timedOut, reported: [0, 1].filter(i => m.results[i])};
    r.match = null;
    r.players.forEach(p => { p.ready = false; p.launch = null; p.armed = false; });
    r.go = null;
    if (matchOver) { r.status = 'done'; r.champion = chosen.winner; } else { r.status = 'waiting'; r.round += 1; }
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRE_MS);
    this.broadcast({type: 'final', ...r.last, score: r.score, matchOver, champion: r.champion});
    this.broadcastState();
  }

  async onLeave(ws, slot) {
    const r = this.room;
    // Only free the seat when nothing is in progress; otherwise keep it for reconnection.
    if (r.status === 'waiting' && r.score[0] + r.score[1] === 0) {
      r.players.splice(slot, 1);
      r.go = null; r.players.forEach(p => { p.armed = false; });
      for (const other of this.sockets()) { const s = this.slotOf(other); if (s > slot) other.serializeAttachment({...other.deserializeAttachment(), slot: s - 1}); }
    }
    ws.serializeAttachment(null);
    await this.save();
    try { ws.close(1000, 'left'); } catch {}
    this.broadcastState();
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'closing'); } catch {}
    if (this.room) this.broadcastState();
  }
  async webSocketError() { if (this.room) this.broadcastState(); }

  async alarm() {
    const r = this.room;
    if (!r) return;
    if (r.status === 'locked' && r.match?.deadline && Date.now() >= r.match.deadline - 50 && (r.match.results[0] || r.match.results[1])) {
      return this.finalize(true);
    }
    if (this.sockets().length === 0) { await this.ctx.storage.deleteAll(); this.room = null; return; }
    await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRE_MS);
  }
}

function startPayload(m) { return {matchId: m.matchId, round: m.round, seed: m.seed, beys: m.beys, launches: m.launches, at: m.at}; }

function sanitizeLaunch(l = {}) {
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  return {rpm: num(l.rpm, 2500, 7000, 4500), tilt: num(l.tilt, 0, 25, 6), speed: num(l.speed, 0, .9, .35), aim: num(l.aim, -1, 1, .5),
    // No `angle`: each slot launches from its own side (launchState default), so players can't overlap.
    ...(Number.isFinite(Number(l.radius)) ? {radius: num(l.radius, .04, .12, .09)} : {})};
}
