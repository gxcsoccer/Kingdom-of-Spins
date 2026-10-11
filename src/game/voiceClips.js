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
