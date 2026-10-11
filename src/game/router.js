// URL routing: keeps the current screen (and simple params) in the address bar so a refresh returns to the same place.
// /map  /explore/harbor  /battle/ran  /fusion  /shop  /collection  /codex  /versus  /starter  /
const SIMPLE = ['map','starter','shop','collection','fusion','codex','versus'];
export function screenToPath(screen, params={}) {
  if (screen==='title') return '/';
  if (screen==='explore' && params.regionId) return `/explore/${params.regionId}`;
  if (screen==='battle' && params.bladerId) {
    const q = new URLSearchParams(); if (params.from) q.set('from', params.from); if (params.regionId) q.set('region', params.regionId);
    const qs = q.toString(); return `/battle/${params.bladerId}${qs?`?${qs}`:''}`;
  }
  if (SIMPLE.includes(screen)) return `/${screen}`;
  return null; // screens with non-serializable params (e.g. free CPU battle) don't get their own URL
}
export function pathToScreen(loc = window.location) {
  const parts = loc.pathname.split('/').filter(Boolean), q = new URLSearchParams(loc.search);
  if (!parts.length) return {screen:'title', params:{}};
  const [s, arg] = parts;
  if (s==='explore' && arg) return {screen:'explore', params:{regionId:arg}};
  if (s==='battle' && arg) return {screen:'battle', params:{bladerId:arg, ...(q.get('from')?{from:q.get('from')}:{}), ...(q.get('region')?{regionId:q.get('region')}:{})}};
  if (SIMPLE.includes(s)) return {screen:s, params:{}};
  return {screen:'title', params:{}};
}
