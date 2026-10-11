// Public Supabase config (URL + publishable key are safe to ship to browsers; RLS protects data).
// Env vars override for other environments.
export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://lwgkaswhnycxoigegifs.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Q55z8A34wzNdTzns6Xo8xw_KBSMWjAx';
