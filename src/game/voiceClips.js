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
// 发给配音服务前去掉孩子昵称（不分大小写；太短的昵称不替换，免得误伤“博士”这类常用词）
const scrub = t => { const n = String(useGame.getState().activeKid?.nickname || '').trim(); let s = String(t || ''); if (n.length >= 2) s = s.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '小探险家'); return s; };
let liveOffUntil = 0, liveCtl = null;
// 浏览器端音频缓存（文本 → blob URL）：预热和播放过的句子不再请求；最多留 60 句，旧的释放掉。
const audioCache = new Map();
const ck = t => voKey(scrub(t)).replace(/[*_#>「」【】]/g, '');   // 缓存键：和播放时的文本处理无关
function remember(text, blob) {
  if (audioCache.has(text)) return audioCache.get(text);
  const u = URL.createObjectURL(blob); audioCache.set(text, u);
  if (audioCache.size > 60) { const [k, old] = audioCache.entries().next().value; audioCache.delete(k); URL.revokeObjectURL(old); }
  return u;
}
const liveOff = () => Date.now() < liveOffUntil;
/** 播放一句博士台词。onEnd：播完；onFail：所有配音都不可用（调用方改用浏览器朗读）。返回 stop()。 */
let seq = 0;   // 每一句一个编号：被打断（stopVoice / 下一句）的那句不再回调，也不会改用浏览器朗读
export function voiceLine(text, {onEnd, onFail} = {}) {
  stopVoice();
  const my = ++seq, mine = () => seq === my, stop = () => { if (mine()) stopVoice(); };
  let failed = false;
  const failOnce = () => { if (failed || !mine()) return; failed = true; onFail?.(); };
  const play = src => {
    if (!mine()) return;
    const a = new Audio(src); cur = a;
    a.onended = () => { if (cur === a) cur = null; if (mine()) onEnd?.(); };
    a.onerror = () => { if (cur === a) cur = null; failOnce(); };
    a.play().catch(err => { if (cur === a) cur = null; if (err?.name !== 'AbortError') failOnce(); });   // 被 pause 打断不算失败
  };
  const file = MANIFEST[voKey(text)];
  if (file) { play(`/audio/vo/${file}`); return stop; }
  const cached = audioCache.get(ck(text));
  if (cached) { play(cached); return stop; }
  if (liveOff() || typeof fetch === 'undefined') { failOnce(); return stop; }
  const ctl = new AbortController(); liveCtl = ctl;
  const timer = setTimeout(() => ctl.abort(), 10000);   // 等太久就改用浏览器朗读
  fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text: scrub(text), voice: 'doctor'}), signal: ctl.signal})
    .then(r => { if (!r.ok) { liveOffUntil = Date.now() + 60_000; throw new Error(r.status); } return r.blob(); })   // 未配置、被限流、上游出错：1 分钟内不再请求
    .then(b => { clearTimeout(timer); const u = remember(ck(text), b); if (liveCtl === ctl) liveCtl = null; play(u); })
    .catch(() => { clearTimeout(timer); if (liveCtl === ctl) liveCtl = null; failOnce(); });
  return stop;
}
export function stopVoice() { seq++; if (liveCtl) { liveCtl.abort(); liveCtl = null; } stopClip(); }
export const pauseVoice = () => { try { cur?.pause(); } catch {} };
export const resumeVoice = () => { try { cur?.play()?.catch?.(() => {}); } catch {} };
/** 一键安静：停掉博士配音和浏览器朗读（关声音、离开页面时用）。 */
export function hush() { stopVoice(); try { globalThis.speechSynthesis?.cancel(); } catch {} }
/** 提前生成（只预热服务器缓存，不播放）：轮到这句时几乎立刻出声。 */
const warmed = new Set();
export function prefetchVoice(...texts) {
  if (liveOff() || typeof fetch === 'undefined') return;
  for (const t of texts.flat()) {
    if (!t || MANIFEST[voKey(t)]) continue;
    const text = scrub(t), key = ck(t); if (warmed.has(key) || audioCache.has(key)) continue; warmed.add(key);
    fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text, voice: 'doctor'})})
      .then(r => { if (!r.ok) { liveOffUntil = Date.now() + 60_000; return; } return r.blob().then(b => remember(key, b)); }).catch(() => {});
  }
}
