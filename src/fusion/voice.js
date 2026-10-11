// Browser speech helpers for 融合博士: TTS via speechSynthesis, hold-to-talk via SpeechRecognition.
import {useCallback, useEffect, useRef, useState} from 'react';
import {playClip, stopClip} from '../game/voiceClips.js';

const synth = typeof window!=='undefined' ? window.speechSynthesis : null;
let zhVoice = null;
function pickVoice() {
  if (!synth) return null;
  const vs = synth.getVoices();
  return zhVoice = vs.find(v=>/zh[-_]CN/i.test(v.lang) && /Tingting|Xiaoxiao|Yaoyao|女|Female/i.test(v.name)) || vs.find(v=>/zh[-_]CN/i.test(v.lang)) || vs.find(v=>/^zh/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export const ttsSupported = Boolean(synth) || typeof Audio !== 'undefined';
export function speak(text, {rate=1.05, pitch=1.2}={}) {
  if (!text) return;
  synth?.cancel();
  // 有预生成的博士配音就用它（声线固定、更像角色），播放失败再回退到浏览器朗读。
  if (playClip(text, {onFail: () => speakSynth(text, rate, pitch)})) return;
  speakSynth(text, rate, pitch);
}
function speakSynth(text, rate, pitch) {
  if (!synth) return;
  synth.cancel();
  // Strip emoji/symbols that TTS engines read out awkwardly.
  const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/[*_#>]/g,'');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'zh-CN'; u.rate = rate; u.pitch = pitch;
  if (zhVoice || pickVoice()) u.voice = zhVoice;
  synth.speak(u);
}
export const stopSpeaking = () => { stopClip(); synth?.cancel(); };

const Recognition = typeof window!=='undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const micSupported = Boolean(Recognition);

// Hold-to-talk: start() on pointer down, stop() on pointer up. onInterim(text) streams partial text,
// onFinal(text) fires once with the full utterance after release.
export function useMic({onInterim, onFinal}={}) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null), text = useRef(''), cbs = useRef({onInterim, onFinal});
  cbs.current = {onInterim, onFinal};
  const start = useCallback(()=>{
    if (!Recognition || rec.current) return;
    stopSpeaking();
    const r = new Recognition();
    r.lang = 'zh-CN'; r.interimResults = true; r.continuous = true;
    text.current = '';
    r.onresult = e => {
      let s = '';
      for (let i=0;i<e.results.length;i++) s += e.results[i][0].transcript;
      text.current = s; cbs.current.onInterim?.(s);
    };
    r.onerror = () => {};
    r.onend = () => { rec.current = null; setListening(false); const t = text.current.trim(); if (t) cbs.current.onFinal?.(t); };
    try { r.start(); rec.current = r; setListening(true); } catch { rec.current = null; }
  }, []);
  const stop = useCallback(()=>{ try { rec.current?.stop(); } catch {} }, []);
  useEffect(()=>()=>{ try { rec.current?.abort(); } catch {} }, []);
  return {supported: micSupported, listening, start, stop};
}
