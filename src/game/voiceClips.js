import {getLocale} from '../i18n/index.js';
// Authored clips (Chinese + English characters), then live Fish audio, then device speech.
import {clipFile} from './voiceCatalog.js';
import {voiceRole} from './voiceProfiles.js';
import {voKey} from './voiceKey.js';
let cur = null;
export const hasClip = (text, voice = 'doctor') => Boolean(clipFile(text, getLocale(), voice));
export function stopClip() { if (cur) { try { cur.pause(); } catch {} cur = null; } }
/** 播放成功开始返回 true；返回 false 时调用方回退到浏览器朗读。 */
export function playClip(text, {onFail, voice = 'doctor'} = {}) {
  const file = clipFile(text, getLocale(), voice);
  if (!file || typeof Audio === 'undefined') return false;
  stopClip();
  const a = new Audio(`/audio/vo/${file}`); cur = a;
  a.play().catch(() => { if (cur === a) cur = null; onFail?.(); });
  return true;
}

// ---- Shared playback for narrators and characters ----
import {useGame} from './store.js';
// 发给配音服务前去掉孩子昵称（不分大小写；太短的昵称不替换，免得误伤“博士”这类常用词）
const scrub = t => { const n = String(useGame.getState().activeKid?.nickname || '').trim(); let s = String(t || ''); if (n.length >= 2) s = s.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), getLocale()==='en'?'explorer':'小探险家'); return s; };
let liveOffUntil = 0, liveCtl = null;
// 浏览器端音频缓存（文本 → blob URL）：预热和播放过的句子不再请求；最多留 60 句，旧的释放掉。
const audioCache = new Map();
const ck = (t, voice = 'doctor', locale = getLocale()) => locale + ':' + voice + ':' + voKey(scrub(t)).replace(/[*_#>「」【】]/g, '');   // 缓存键：和播放时的文本处理无关
function remember(text, blob) {
  if (audioCache.has(text)) return audioCache.get(text);
  const u = URL.createObjectURL(blob); audioCache.set(text, u);
  if (audioCache.size > 60) { const [k, old] = audioCache.entries().next().value; audioCache.delete(k); URL.revokeObjectURL(old); }
  return u;
}
const liveOff = () => Date.now() < liveOffUntil;
/** 播放一句台词。onEnd：播完；onFail：所有配音都不可用（调用方改用浏览器朗读）。返回 stop()。 */
let seq = 0;   // 每一句一个编号：被打断（stopVoice / 下一句）的那句不再回调，也不会改用浏览器朗读
export function voiceLine(text, {onEnd, onFail, voice = 'doctor'} = {}) {
  hush();
  voice = voiceRole(voice);
  const locale = getLocale(), key = ck(text, voice, locale);
  const my = ++seq, mine = () => seq === my, stop = () => { if (mine()) stopVoice(); };
  let failed = false;
  const failOnce = () => { if (failed || !mine()) return; failed = true; onFail?.(); };
  const play = (src, onError = failOnce) => {
    if (!mine()) return;
    const a = new Audio(src); cur = a;
    a.onended = () => { if (cur === a) cur = null; if (mine()) onEnd?.(); };
    a.onerror = () => { if (cur === a) cur = null; if (mine()) onError(); };
    a.play().catch(err => {
      if (cur === a) cur = null;
      if (!mine() || err?.name === 'AbortError') return;
      // A blocked user gesture won't be fixed by synthesizing the same clip again.
      if (err?.name === 'NotAllowedError') failOnce(); else onError();
    });
  };
  let requested = false;
  const live = () => {
    if (requested || !mine()) return;
    requested = true;
    const cached = audioCache.get(key);
    if (cached) { play(cached); return; }
    if (liveOff() || typeof fetch === 'undefined') { failOnce(); return; }
    const ctl = new AbortController(); liveCtl = ctl;
    const timer = setTimeout(() => ctl.abort(), 10000);   // 等太久就改用浏览器朗读
    fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text: scrub(text), voice, locale}), signal: ctl.signal})
      .then(r => { if (!r.ok) { liveOffUntil = Date.now() + 60_000; throw new Error(r.status); } return r.blob(); })   // 未配置、被限流、上游出错：1 分钟内不再请求
      .then(b => { clearTimeout(timer); const u = remember(key, b); if (liveCtl === ctl) liveCtl = null; play(u); })
      .catch(() => { clearTimeout(timer); if (liveCtl === ctl) liveCtl = null; failOnce(); });
  };
  const file = clipFile(text, locale, voice);
  if (file) play(`/audio/vo/${file}`, live); else live();
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
    const value = typeof t === 'string' ? t : t?.text, voice = voiceRole(t?.voice), locale = getLocale();
    if (!value || hasClip(value, voice)) continue;
    const text = scrub(value), key = ck(value, voice, locale); if (warmed.has(key) || audioCache.has(key)) continue; warmed.add(key);
    fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text, voice, locale})})
      .then(r => { if (!r.ok) { liveOffUntil = Date.now() + 60_000; return; } return r.blob().then(b => remember(key, b)); }).catch(() => {});
  }
}
