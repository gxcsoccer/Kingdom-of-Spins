// Smoke test for the PvP room flow against a running worker: node scripts/room-smoke.mjs [origin]
import {createRoom, joinRoom} from '../src/net/room.js';
const origin = process.argv[2] || 'http://127.0.0.1:8787';
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout waiting'); await wait(50); } };
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a);
const bey = id => ({id, name: id, blade: {wings: 3}, ratchet: {height: 60}, bit: 'ball'});
const {data, error} = await createRoom({origin});
if (error) throw new Error(JSON.stringify(error));
log('room', data.code);
const finals = [], starts = [[], []];
let lastState = null;
const mk = (name, pid, i, hostWinner) => joinRoom(data.code, {nickname: name, bey: bey(name), pid, origin}, {
  onState: (r, you) => { lastState = r; },
  onStart: m => { starts[i].push(m); log(name, 'start', m.round, 'seed', m.seed, 'launches', JSON.stringify(m.launches.map(l => l.rpm))); },
  onFinal: f => { finals.push([i, f]); },
  onError: e => log(name, 'error', e.code, e.message),
});
const A = mk('alice', 'pid-a', 0);
await until(() => lastState?.players.length === 1);
const B = mk('bob', 'pid-b', 1);
await until(() => lastState?.players.length === 2 && lastState.players.every(p => p.connected));
// Round 1: both agree, A wins by over (2 pts)
A.ready({rpm: 5000, tilt: 4, angle: 9}); B.ready({rpm: 99999});
await until(() => starts[0].length === 1 && starts[1].length === 1);
let m = starts[0].at(-1);
if (!m || starts[1].at(-1)?.seed !== m.seed) throw new Error('start not broadcast consistently');
A.sendResult({matchId: m.matchId, winner: 0, reason: 'over', time: 3.2});
B.sendResult({matchId: m.matchId, winner: 0, reason: 'over', time: 3.2});
B.sendResult({matchId: m.matchId, winner: 1, reason: 'xtreme', time: 3.2}); // duplicate → ignored
await until(() => finals.length === 2); await wait(500);
log('after r1 score', lastState.score, 'finals', finals.length);
// Round 2: disagreement → host result wins, mismatch flag
A.ready({}); B.ready({});
await until(() => starts[0].length === 2 && starts[1].length === 2);
m = starts[0].at(-1);
B.sendResult({matchId: m.matchId, winner: 1, reason: 'spin', time: 9});
// Simulate host reconnect mid-match: drop A, rejoin with same pid, expect start re-sent
A.leave();
const A2 = mk('alice', 'pid-a', 0);
await until(() => starts[0].length === 3);
log('A2 got start again:', starts[0].at(-1).matchId === m.matchId);
A2.sendResult({matchId: m.matchId, winner: 0, reason: 'xtreme', time: 9});
await until(() => finals.some(([, f]) => f.round === 2)); await wait(300);
const f2 = finals.at(-1)[1];
log('r2 final', f2.winner, f2.reason, 'mismatch', f2.mismatch, 'score', f2.score, 'matchOver', f2.matchOver, 'champion', f2.champion);
// Third player rejected
const C = joinRoom(data.code, {nickname: 'carol', bey: bey('carol'), pid: 'pid-c', origin}, {onError: e => log('carol error', e.code)});
await wait(2500);
// Bad code
const D = joinRoom('ZZZZZ', {nickname: 'dave', pid: 'pid-d', origin}, {onError: e => log('dave error', e.code)});
await wait(2500);
const ok = lastState.score[0] === 5 && f2.mismatch === true && f2.matchOver === true && lastState.status === 'done';
log(ok ? 'PASS' : 'FAIL', JSON.stringify(lastState.score), lastState.status);
[A2, B, C, D].forEach(x => x.leave());
process.exit(ok ? 0 : 1);
