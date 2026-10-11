// Parent auth (Google via Supabase) + kid profiles + cloud saves.
// Every function is no-throw and returns {data, error}; callers fall back to guest/localStorage mode.
import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from './config.js';

let client = null;
export function isConfigured() { return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); }
export function supabase() {
  if (!isConfigured()) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce'}});
  return client;
}

const NOT_CONFIGURED = {data: null, error: {message: 'not configured'}};
async function safe(fn) {
  const sb = supabase();
  if (!sb) return NOT_CONFIGURED;
  try { const {data, error} = await fn(sb); return {data: error ? null : data, error: error || null}; }
  catch (e) { return {data: null, error: {message: String(e?.message || e)}}; }
}

export const getSession = () => safe(async sb => {
  const {data, error} = await sb.auth.getSession();
  return {data: data?.session || null, error};
});

export const signInWithGoogle = (redirectTo = location.origin + location.pathname) =>
  safe(sb => sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo, queryParams: {prompt: 'select_account'}}}));

export const signOut = () => safe(sb => sb.auth.signOut());

// cb(session|null, event). Returns an unsubscribe function.
export function onAuthChange(cb) {
  const sb = supabase();
  if (!sb) return () => {};
  const {data} = sb.auth.onAuthStateChange((event, session) => cb(session, event));
  return () => data?.subscription?.unsubscribe();
}

export const listKids = () => safe(sb =>
  sb.from('kid_profiles').select('id,nickname,avatar,pin,created_at').order('created_at'));

export const createKid = ({nickname, avatar = null, pin = null}) => safe(sb =>
  sb.from('kid_profiles').insert({nickname, avatar, pin: pin || null}).select('id,nickname,avatar,pin,created_at').single());

export const deleteKid = id => safe(sb => sb.from('kid_profiles').delete().eq('id', id));

export const loadSave = kidId => safe(async sb => {
  const {data, error} = await sb.from('saves').select('data,updated_at').eq('kid_id', kidId).maybeSingle();
  return {data: data ? data.data : null, error};
});

export const writeSave = (kidId, data) => safe(sb =>
  sb.from('saves').upsert({kid_id: kidId, data, updated_at: new Date().toISOString()}).select('updated_at').single());

// Whether an OAuth provider is enabled on the Supabase project (public settings endpoint). Cached.
let settingsPromise = null;
export async function providerEnabled(name = 'google') {
  if (!isConfigured()) return false;
  settingsPromise ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, {headers: {apikey: SUPABASE_ANON_KEY}})
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  const s = await settingsPromise;
  if (!s) settingsPromise = null; // retry next time on network failure
  return Boolean(s?.external?.[name]);
}
