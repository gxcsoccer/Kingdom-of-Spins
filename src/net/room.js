// PvP room client (Cloudflare Durable Object over WebSocket).
// Flow: createRoom() → share code → joinRoom(code, ...) on both devices → ready(launch) → on 'start' run the
// deterministic simulation locally with {beys, launches, seed} → sendResult({matchId, winner, reason, time}) → 'final'.
// Slot 0 (room creator / first joiner) launches from angle π, slot 1 from angle 0 (launchState defaults).

const base = (opts = {}) => opts.origin || (typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:8787');

export async function createRoom(opts) {
  try {
    const res = await fetch(`${base(opts)}/api/rooms`, {method: 'POST'});
    const data = await res.json();
    return res.ok ? {data, error: null} : {data: null, error: data};
  } catch (e) { return {data: null, error: {message: String(e?.message || e)}}; }
}

export function playerId() {
  const KEY = 'kos.pid';
  try {
    let id = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); }
    sessionStorage.setItem(KEY, id); // per-tab, so two tabs on one machine are two players
    return id;
  } catch { return crypto.randomUUID(); }
}

/**
 * handlers: {
 *   onState(room, youSlot)   room = {code,status:'waiting'|'locked'|'done',score:[a,b],round,target,players:[{slot,nickname,bey,ready,connected}],match,last,champion}
 *   onStart({matchId, round, seed, beys:[A,B], launches:[A,B]})
 *   onFinal({matchId, round, winner, reason, points, score, mismatch, matchOver, champion})
 *   onError({code, message}), onConnection('open'|'reconnecting'|'closed')
 * }
 */
export function joinRoom(code, {nickname, bey, pid = playerId(), origin} = {}, handlers = {}) {
  const url = `${base({origin}).replace(/^http/, 'ws')}/ws/room/${encodeURIComponent(String(code).toUpperCase())}`;
  let ws = null, closed = false, retries = 0, pingTimer = null, slot = -1;
  const queue = [];
  const h = name => (...args) => { try { handlers[name]?.(...args); } catch (e) { console.error(e); } };
  const onState = h('onState'), onStart = h('onStart'), onFinal = h('onFinal'), onError = h('onError'), onConnection = h('onConnection');

  function send(msg) {
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); else queue.push(msg);
  }
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retries = 0;
      onConnection('open');
      ws.send(JSON.stringify({type: 'join', pid, nickname, bey}));
      while (queue.length) ws.send(JSON.stringify(queue.shift()));
      clearInterval(pingTimer);
      pingTimer = setInterval(() => ws?.readyState === 1 && ws.send('{"type":"ping"}'), 25_000);
    };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'joined') slot = msg.slot;
      else if (msg.type === 'state') { slot = msg.you; onState(msg.room, msg.you); }
      else if (msg.type === 'start') onStart(msg);
      else if (msg.type === 'final') onFinal(msg);
      else if (msg.type === 'error') { onError(msg); if (msg.code === 'full' || msg.code === 'no-room') closed = true; }
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      if (closed) return onConnection('closed');
      onConnection('reconnecting');
      setTimeout(connect, Math.min(8000, 500 * 2 ** retries++));
    };
    ws.onerror = () => {};
  }
  connect();

  return {
    get slot() { return slot; },
    setBey(b) { send({type: 'bey', bey: b}); },
    ready(launch, b) { send({type: 'ready', launch, ...(b ? {bey: b} : {})}); },
    unready() { send({type: 'unready'}); },
    sendResult({matchId, winner, reason, time}) { send({type: 'result', matchId, winner, reason, time}); },
    rematch() { send({type: 'rematch'}); },
    leave() { closed = true; clearInterval(pingTimer); try { ws?.readyState === 1 && ws.send('{"type":"leave"}'); ws?.close(1000); } catch {} },
  };
}
