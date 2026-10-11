// Bridges the kid profile (Supabase) with the local game store: per-kid save slot + debounced cloud writes.
import {useGame} from './store.js';
import {getSession, loadSave, writeSave, listKids} from '../net/auth.js';

const LAST_KID = 'kos-last-kid';
const GUEST_KEY = 'kos-save-v1';
let timer = null, pending = null;

function debouncedWriter(kidId, ms = 1500) {
  const flush = () => { if (pending) { const data = pending; pending = null; writeSave(kidId, data); } };
  addEventListener?.('pagehide', flush);
  return save => { pending = save; clearTimeout(timer); timer = setTimeout(flush, ms); };
}

export async function activateKid(kid) {
  const {data: remote, error} = await loadSave(kid.id);
  const key = 'kos-save-kid-' + kid.id;
  // Remote wins when present; otherwise keep whatever this device has locally for the kid.
  useGame.getState().useSlot(key, error ? null : remote);
  useGame.setState({onChange: null});
  useGame.getState().setProfile({nickname: kid.nickname, avatar: kid.avatar || null, kidId: kid.id});
  const write = debouncedWriter(kid.id);
  useGame.setState({onChange: write, activeKid: {id: kid.id, nickname: kid.nickname, avatar: kid.avatar}});
  if (!remote) write(useGame.getState().save); // first cloud copy
  try { localStorage.setItem(LAST_KID, kid.id); } catch {}
  return {error};
}

export function deactivateKid() {
  clearTimeout(timer); pending = null;
  try { localStorage.removeItem(LAST_KID); } catch {}
  useGame.setState({onChange: null, activeKid: null});
  useGame.getState().useSlot(GUEST_KEY);
}

// Call once on app start: if a parent session exists and a kid was active last time, restore it.
// (PIN is not re-asked on the same device for the remembered kid.)
export async function restoreLastKid() {
  let id; try { id = localStorage.getItem(LAST_KID); } catch {}
  if (!id) return null;
  const {data: session} = await getSession();
  if (!session) return null;
  const {data: kids} = await listKids();
  const kid = kids?.find(k => k.id === id);
  if (!kid) return null;
  await activateKid(kid);
  return kid;
}
