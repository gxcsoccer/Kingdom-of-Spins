// 预生成的配音（scripts/gen-voice.mjs，Fish Audio）：台词有对应的音频就播放它，没有就交给浏览器朗读。
import MANIFEST from './voiceClips.json';
import {voKey} from './voiceKey.js';
let cur = null;
export const hasClip = text => Boolean(MANIFEST[voKey(text)]);
export function stopClip() { if (cur) { try { cur.pause(); } catch {} cur = null; } }
/** 播放成功开始返回 true；返回 false 时调用方回退到浏览器朗读。 */
export function playClip(text, {onFail} = {}) {
  const file = MANIFEST[voKey(text)];
  if (!file || typeof Audio === 'undefined') return false;
  stopClip();
  const a = new Audio(`/audio/vo/${file}`); cur = a;
  a.play().catch(() => { if (cur === a) cur = null; onFail?.(); });
  return true;
}

// ---- 统一的“博士开口”：预生成配音 → 实时配音（/api/tts）→ 浏览器朗读 ----
import {useGame} from './store.js';
const scrub = t => { const n = useGame.getState().activeKid?.nickname; let s = String(t || ''); if (n) s = s.split(n).join('小探险家'); return s; };
let liveOffUntil = 0, liveCtl = null;
const liveOff = () => Date.now() < liveOffUntil;
/** 播放一句博士台词。onEnd：播完；onFail：所有配音都不可用（调用方改用浏览器朗读）。返回 stop()。 */
export function voiceLine(text, {onEnd, onFail} = {}) {
  stopVoice();
  const file = MANIFEST[voKey(text)];
  const play = src => { const a = new Audio(src); cur = a; a.onended = () => { if (cur === a) cur = null; onEnd?.(); }; a.onerror = () => { if (cur === a) cur = null; onFail?.(); }; a.play().catch(() => { if (cur === a) cur = null; onFail?.(); }); };
  if (file) { play(`/audio/vo/${file}`); return stopVoice; }
  if (liveOff() || typeof fetch === 'undefined') { onFail?.(); return stopVoice; }
  const ctl = new AbortController(); liveCtl = ctl;
  const timer = setTimeout(() => ctl.abort(), 10000);   // 等太久就改用浏览器朗读
  fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text: scrub(text), voice: 'doctor'}), signal: ctl.signal})
    .then(r => { if (r.status === 503) liveOffUntil = Date.now() + 60_000; if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => { clearTimeout(timer); if (liveCtl !== ctl) return; liveCtl = null; play(URL.createObjectURL(b)); })
    .catch(() => { clearTimeout(timer); if (liveCtl !== ctl) return; liveCtl = null; onFail?.(); });
  return stopVoice;
}
export function stopVoice() { if (liveCtl) { liveCtl.abort(); liveCtl = null; } stopClip(); }
/** 提前生成（只预热服务器缓存，不播放）：轮到这句时几乎立刻出声。 */
const warmed = new Set();
export function prefetchVoice(...texts) {
  if (liveOff() || typeof fetch === 'undefined') return;
  for (const t of texts.flat()) {
    if (!t || MANIFEST[voKey(t)]) continue;
    const text = scrub(t); if (warmed.has(text)) continue; warmed.add(text);
    fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text, voice: 'doctor'})}).then(r => r.body?.cancel?.()).catch(() => {});
  }
}
