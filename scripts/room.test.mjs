import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {installGlobal} from './helpers/fakes.mjs';
import {BEYS} from '../src/game/beys.js';

register('./helpers/test-loader.mjs', import.meta.url);
const {BattleRoom, TARGET} = await import('../worker/room.js');

async function setup(t) {
  t.mock.timers.enable({apis: ['Date'], now: 1_000_000});
  installGlobal(t, 'WebSocketRequestResponsePair', class {});
  const sockets = [], records = new Map();
  let alarmAt = null;
  const ctx = {
    storage: {
      get: async key => records.get(key),
      put: async (key, value) => records.set(key, structuredClone(value)),
      setAlarm: async at => { alarmAt = at; },
      deleteAll: async () => { records.clear(); },
    },
    blockConcurrencyWhile(fn) { this.ready = fn(); },
    setWebSocketAutoResponse() {},
    getWebSockets: () => sockets.filter(s => !s.closed),
  };
  const room = new BattleRoom(ctx, {});
  await ctx.ready;
  assert.equal((await room.fetch(new Request('https://room/init?code=ABCDE', {method: 'POST'}))).status, 200);
  async function join(pid) {
    const ws = {
      attachment: null, messages: [], closed: false,
      serializeAttachment(value) { this.attachment = structuredClone(value); },
      deserializeAttachment() { return this.attachment; },
      send(raw) { this.messages.push(JSON.parse(raw)); },
      close() { this.closed = true; },
    };
    sockets.push(ws);
    await send(ws, {type: 'join', pid, nickname: pid, bey: BEYS.dragoon});
    return ws;
  }
  const send = (ws, msg) => room.webSocketMessage(ws, JSON.stringify(msg));
  const a = await join('A'), b = await join('B');
  async function start(launchA = {}, launchB = {}) {
    await send(a, {type: 'ready', launch: launchA});
    await send(b, {type: 'ready', launch: launchB});
    return room.room.match.matchId;
  }
  const result = (ws, matchId, winner = 0, reason = 'spin') => send(ws, {type: 'result', matchId, winner, reason, time: 4.2});
  return {room, a, b, join, send, start, result, get alarmAt() { return alarmAt; }};
}
const last = (ws, type) => ws.messages.filter(m => m.type === type).at(-1);

test('a round starts only after both players are ready, with identical sanitized inputs', async t => {
  const {room, a, b, send} = await setup(t);
  await send(a, {type: 'ready', launch: {rpm: 99999, tilt: -1, speed: 9, aim: -2, angle: 3}});
  assert.equal(room.room.status, 'waiting');
  assert.equal(last(a, 'start'), undefined);
  await send(b, {type: 'ready', launch: {}});
  assert.deepEqual(last(a, 'start'), last(b, 'start'));
  assert.deepEqual(last(a, 'start').launches[0], {rpm: 7000, tilt: 0, speed: .9, aim: -1});
  assert.ok(last(a, 'start').at > Date.now());
});

test('arm synchronizes the countdown and pull is relayed only to the opponent', async t => {
  const {a, b, send} = await setup(t);
  await send(a, {type: 'arm'});
  assert.equal(last(a, 'go'), undefined);
  await send(b, {type: 'arm'});
  assert.deepEqual(last(a, 'go'), last(b, 'go'));
  assert.equal(last(a, 'go').deadline - last(a, 'go').at, 10000);
  await send(a, {type: 'pull', power: 2});
  assert.equal(last(a, 'pull'), undefined);
  assert.deepEqual(last(b, 'pull'), {type: 'pull', slot: 0, power: 1});
});

test('agreed results award one round and late duplicate reports cannot score again', async t => {
  const {room, a, b, start, result} = await setup(t);
  const id = await start();
  await result(a, id, 0, 'xtreme');
  await result(b, id, 0, 'xtreme');
  await result(b, id, 1, 'over');
  assert.deepEqual(room.room.score, [1, 0]);
  assert.equal(room.room.round, 2);
  assert.equal(room.room.status, 'waiting');
  assert.equal(last(a, 'final').points, 3);
  assert.equal(a.messages.filter(m => m.type === 'final').length, 1);
});

test('disagreements use the host result and are marked as mismatches', async t => {
  const {room, a, b, start, result} = await setup(t);
  const id = await start();
  await result(b, id, 1, 'over');
  await result(a, id, 0, 'spin');
  assert.deepEqual(room.room.score, [1, 0]);
  assert.equal(last(a, 'final').mismatch, true);
  assert.equal(last(a, 'final').winner, 0);
});

test('three round wins end the match and rematch resets readiness and scores', async t => {
  const {room, a, b, start, result, send} = await setup(t);
  for (let i = 0; i < TARGET; i++) {
    const id = await start();
    await result(a, id); await result(b, id);
  }
  assert.equal(room.room.status, 'done');
  assert.equal(last(a, 'final').matchOver, true);
  assert.equal(last(a, 'final').champion, 0);
  await send(a, {type: 'rematch'});
  assert.equal(room.room.status, 'waiting');
  assert.deepEqual(room.room.score, [0, 0]);
  assert.ok(room.room.players.every(p => !p.ready && !p.armed));
});

test('a reconnect must not postpone the result timeout', async t => {
  const h = await setup(t);
  const id = await h.start();
  await h.result(h.a, id);
  const deadline = h.alarmAt;
  h.b.close();
  await h.join('B');
  assert.equal(h.alarmAt, deadline, 'rejoin must preserve the 20-second result alarm');
  t.mock.timers.tick(deadline - Date.now());
  await h.room.alarm();
  assert.equal(h.room.room.status, 'waiting');
  assert.equal(last(h.a, 'final').timedOut, true);
});

test('a reconnect receives the final it missed while offline', async t => {
  const {a, b, start, result, join} = await setup(t);
  const id = await start();
  await result(b, id);
  b.close();
  await result(a, id);
  const rejoined = await join('B');
  assert.deepEqual(last(rejoined, 'final'), last(a, 'final'), 'client needs final to leave its round banner');
});

test('a locked match is replayed to the same player after reconnection', async t => {
  const {a, b, start, join, room} = await setup(t);
  await start();
  b.close();
  const rejoined = await join('B');
  assert.equal(room.room.players.length, 2);
  assert.equal(last(rejoined, 'joined').slot, 1);
  assert.deepEqual(last(rejoined, 'start'), last(a, 'start'));
});

test('a third player cannot claim a full room', async t => {
  const {room, join} = await setup(t);
  const c = await join('C');
  assert.equal(last(c, 'error').code, 'full');
  assert.equal(c.closed, true);
  assert.equal(room.room.players.length, 2);
});

test('result reasons must be own scoring keys, not inherited object properties', async t => {
  const {room, a, start, result} = await setup(t);
  const id = await start();
  await result(a, id, 0, 'toString');
  assert.deepEqual(room.room.match.results, {});
  assert.equal(last(a, 'error').message, 'bad result');
});
