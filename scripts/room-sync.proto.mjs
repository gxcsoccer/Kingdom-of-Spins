// Protocol smoke test for synced rounds (arm → go, pull relay, start.at, clock, reconnect). Run against `wrangler dev`:
//   node scripts/room-sync.proto.mjs http://127.0.0.1:8798
const base = process.argv[2] || 'http://127.0.0.1:8787';
const {code} = await (await fetch(base + '/api/rooms', {method: 'POST'})).json();
const url = base.replace(/^http/, 'ws') + '/ws/room/' + code;
const bey = {id: 'dragoon', name: 'Dragoon'};
function client(pid, nickname) {
  const ws = new WebSocket(url), inbox = [];
  const c = {ws, inbox, send: m => ws.send(JSON.stringify(m)),
    wait: (type, pred = () => true, ms = 5000) => new Promise((res, rej) => {
      const hit = () => { const i = inbox.findIndex(m => m.type === type && pred(m)); if (i >= 0) { res(inbox.splice(i, 1)[0]); return true; } };
      if (hit()) return; const t0 = Date.now(); const iv = setInterval(() => { if (hit()) clearInterval(iv); else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error(`${nickname}: no ${type}`)); } }, 20);
    })};
  ws.onmessage = e => inbox.push(JSON.parse(e.data));
  c.open = new Promise(r => ws.onopen = () => { c.send({type: 'join', pid, nickname, bey}); r(); });
  return c;
}
const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exit(1); } console.log('ok  ', msg); };
let A = client('pa', 'A'), B = client('pb', 'B');
await Promise.all([A.open, B.open]);
const ja = await A.wait('joined'); ok(Number.isFinite(ja.serverNow), 'joined carries serverNow');
A.send({type: 'clock', t: Date.now()}); const ck = await A.wait('clock'); ok(Number.isFinite(ck.now) && ck.t > 0, 'clock echo');
A.send({type: 'arm'}); await new Promise(r => setTimeout(r, 300));
ok(!A.inbox.some(m => m.type === 'go'), 'one arm alone does not start');
B.send({type: 'arm'});
const [ga, gb] = await Promise.all([A.wait('go'), B.wait('go')]);
ok(ga.at === gb.at && ga.deadline - ga.at === 10000 && ga.at - Date.now() > 2500, `go broadcast to both, same at (+${ga.at - Date.now()}ms), 10 s window`);
A.send({type: 'pull', power: .72}); const pb = await B.wait('pull'); ok(pb.power === .72 && pb.slot === 0, 'pull relayed to the other kid');
await new Promise(r => setTimeout(r, 200)); ok(!A.inbox.some(m => m.type === 'pull'), 'pull not echoed to sender');
// reconnect during the launch window: B drops and rejoins with the same pid → gets the same go again
B.ws.close(); await new Promise(r => setTimeout(r, 300));
B = client('pb', 'B'); await B.open; const g2 = await B.wait('go'); ok(g2.at === ga.at, 'reconnect re-sends the in-flight go');
// "timeout": A launches, B auto-launches after the deadline (client side) — server just waits for both readies
A.send({type: 'ready', launch: {rpm: 6000, speed: .4, aim: .3, tilt: 5}});
B.send({type: 'ready', launch: {rpm: 5300, speed: .37, aim: .3, tilt: 5}});
const [sa, sb] = await Promise.all([A.wait('start'), B.wait('start')]);
ok(sa.matchId === sb.matchId && sa.at === sb.at && sa.at > Date.now(), `start carries shared at (+${sa.at - Date.now()}ms)`);
A.send({type: 'result', matchId: sa.matchId, winner: 0, reason: 'spin', time: 9});
B.send({type: 'result', matchId: sa.matchId, winner: 0, reason: 'spin', time: 9});
const fa = await A.wait('final'); ok(fa.score[0] === 1 && !fa.mismatch, 'final after both results');
const st = await A.wait('state', m => m.room.round === 2); ok(st.room.players.every(p => !p.armed) && !st.room.go, 'round 2 needs a fresh arm');
// legacy client (never arms) still works: ready without arm → start
A.send({type: 'ready', launch: {}}); B.send({type: 'ready', launch: {}});
await Promise.all([A.wait('start'), B.wait('start')]); ok(true, 'legacy ready-without-arm still starts a round');
A.ws.close(); B.ws.close();
console.log('all protocol checks passed for room', code);
process.exit(0);
