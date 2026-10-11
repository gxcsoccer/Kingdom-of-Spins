// Bridges the kid profile (Supabase) with the local game store: per-kid save slot + debounced cloud writes.
import {useGame} from './store.js';
import {getSession, loadSave, writeSave, listKids} from '../net/auth.js';

const LAST_KID = 'kos-last-kid';
const GUEST_KEY = 'kos-save-v1';
let writer = null, activation = 0;
let stopping = Promise.resolve();

function debouncedWriter(kidId, ms = 1500) {
  // Each writer owns its slot and pending data; an old pagehide callback must
  // never consume another kid's save. Serialize writes so slow requests cannot
  // finish after (and overwrite) a newer save.
  let timer = null, pending = null, flight = null;
  const flush = async () => {
    clearTimeout(timer);
    if (flight) { await flight; return flush(); }
    if (!pending) return;
    const data = pending; pending = null;
    flight = writeSave(kidId, data);
    try { return await flight; } finally { flight = null; }
  };
  globalThis.addEventListener?.('pagehide', flush);
  return {
    write(save) { pending = save; clearTimeout(timer); timer = setTimeout(flush, ms); },
    stop(discard = false) {
      clearTimeout(timer);
      globalThis.removeEventListener?.('pagehide', flush);
      if (discard) pending = null;
      return flush();
    },
  };
}

function stopWriter(discard = false) {
  const previous = writer; writer = null;
  // A second selection can arrive while the first selection is flushing.
  // Every reader must wait for that write, including a switch back to its slot.
  if (previous) stopping = Promise.all([stopping, previous.stop(discard)]).then(() => {});
  return stopping;
}

export async function activateKid(kid) {
  const request = ++activation;
  useGame.setState({onChange: null});
  await stopWriter();
  if (request !== activation) return {error: null, cancelled: true};
  const {data: remote, error} = await loadSave(kid.id);
  if (request !== activation) return {error: null, cancelled: true};
  const key = 'kos-save-kid-' + kid.id;
  // Remote wins when present; otherwise keep whatever this device has locally for the kid.
  useGame.getState().useSlot(key, error ? null : remote);
  useGame.setState({onChange: null});
  useGame.getState().setProfile({nickname: kid.nickname, avatar: kid.avatar || null, kidId: kid.id});
  // A failed read is not an empty cloud slot. Keep local play available, but
  // require a successful activation before replacing unseen cloud progress.
  writer = error ? null : debouncedWriter(kid.id);
  useGame.setState({onChange: writer?.write || null, activeKid: {id: kid.id, nickname: kid.nickname, avatar: kid.avatar}});
  if (!remote && !error) writer.write(useGame.getState().save); // first cloud copy
  try { localStorage.setItem(LAST_KID, kid.id); } catch {}
  return {error};
}

export function deactivateKid({discardPending = false} = {}) {
  ++activation;
  try { localStorage.removeItem(LAST_KID); } catch {}
  useGame.setState({onChange: null, activeKid: null});
  useGame.getState().useSlot(GUEST_KEY);
  return stopWriter(discardPending);
}

// Call once on app start: if a parent session exists and a kid was active last time, restore it.
// (PIN is not re-asked on the same device for the remembered kid.)
export async function restoreLastKid() {
  const request = activation;
  let id; try { id = localStorage.getItem(LAST_KID); } catch {}
  if (!id) return null;
  const {data: session} = await getSession();
  if (!session) return null;
  const {data: kids} = await listKids();
  const kid = kids?.find(k => k.id === id);
  if (!kid || request !== activation) return null;
  await activateKid(kid);
  return kid;
}
