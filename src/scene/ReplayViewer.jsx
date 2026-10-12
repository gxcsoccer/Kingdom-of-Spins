import {tr} from '../i18n/index.js';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import BattleScene from './BattleScene.jsx';
import './scene.css';

// ---------- replay player: same interface BattleScene expects (getTime/getState/events/beys)
const lerp = (a, b, t) => a + (b - a) * t;
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map(x => -x); d = -d; }
  if (d > .9995) { const r = a.map((x, i) => lerp(x, b[i], t)); const n = Math.hypot(...r); return r.map(x => x / n); }
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((x, i) => x * wa + b[i] * wb);
}

export function createReplayPlayer({ beys, samples = [], events = [] }) {
  const end = samples.at(-1)?.time ?? 0;
  const listeners = new Set();
  const p = {
    beys, samples, events, duration: end,
    clock: 0, speed: 1, paused: true, lastWall: null, seekVersion: 0, stopAt: null,
    emit() { listeners.forEach(f => f(p)); },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    getTime() {
      const now = performance.now();
      if (!p.paused && p.lastWall != null) {
        p.clock = Math.min(end, p.clock + Math.min(.1, (now - p.lastWall) / 1000) * p.speed);
        if (p.stopAt != null && p.clock >= p.stopAt) { p.clock = p.stopAt; p.stopAt = null; p.paused = true; p.emit(); }
        else if (p.clock >= end) { p.paused = true; p.emit(); }
      }
      p.lastWall = now;
      return p.clock;
    },
    getState(t) {
      const s = samples; if (!s.length) return null;
      if (t <= s[0].time) return s[0];
      let lo = 0, hi = s.length - 1;
      if (t >= s[hi].time) return s[hi];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].time <= t) lo = m; else hi = m; }
      const a = s[lo], b = s[hi], k = (t - a.time) / (b.time - a.time || 1);
      return { time: t, bodies: a.bodies.map((x, i) => ({ p: x.p.map((v, j) => lerp(v, b.bodies[i].p[j], k)), q: slerp(x.q, b.bodies[i].q, k), rpm: lerp(x.rpm, b.bodies[i].rpm, k), tilt: lerp(x.tilt, b.bodies[i].tilt, k) })) };
    },
    play() { if (p.clock >= end - 1e-3) p.seek(0); p.paused = false; p.lastWall = performance.now(); p.emit(); },
    pause() { p.getTime(); p.paused = true; p.stopAt = null; p.emit(); },
    setSpeed(x) { p.getTime(); p.speed = x; p.emit(); },
    // Jump: bump seekVersion so BattleScene skips effects for events we jumped over.
    seek(t) { p.clock = Math.max(0, Math.min(end, t)); p.lastWall = performance.now(); p.seekVersion++; p.emit(); },
  };
  return p;
}

// ---------- helpers
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const fmt = t => `${t.toFixed(1)}s`;

function Sparkline({ samples, duration, beys }) {
  const paths = useMemo(() => {
    if (!samples.length || !duration) return [];
    const maxRpm = Math.max(1, ...samples.map(s => Math.max(...s.bodies.map(b => Math.abs(b.rpm)))));
    const step = Math.max(1, Math.floor(samples.length / 400));
    return samples[0].bodies.map((_, i) => {
      let d = '';
      for (let k = 0; k < samples.length; k += step) {
        const s = samples[k];
        d += `${k ? 'L' : 'M'}${(s.time / duration * 1000).toFixed(1)},${(100 - Math.abs(s.bodies[i].rpm) / maxRpm * 92).toFixed(1)}`;
      }
      return d;
    });
  }, [samples, duration]);
  return (
    <svg className="ks-rv-spark" viewBox="0 0 1000 100" preserveAspectRatio="none">
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={beys[i]?.colors?.primary || '#111'} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/**
 * <ReplayViewer ref beys samples events moments activeMoment onSeek? height=420 />
 * ref: seek(t), playMoment(id), pause(), play()
 */
const ReplayViewer = forwardRef(function ReplayViewer({ beys, samples = [], events = [], moments = [], activeMoment, onSeek, height = 420, className = '', style }, ref) {
  const player = useMemo(() => createReplayPlayer({ beys, samples, events }), [beys, samples, events]);
  const duration = player.duration || 1;
  const [ui, setUi] = useState({ paused: true, speed: 1 });
  const [caption, setCaption] = useState(null);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef(), trackRef = useRef(), headRef = useRef(), timeRef = useRef(), captionTimer = useRef();
  const drag = useRef(null);

  useEffect(() => player.subscribe(pl => setUi({ paused: pl.paused, speed: pl.speed })), [player]);

  // Playhead without React re-renders.
  useEffect(() => {
    let raf;
    const loop = () => {
      const t = player.getTime(); // advance the clock even if the canvas isn't rendering
      if (headRef.current) headRef.current.style.left = `${(t / duration) * 100}%`;
      if (timeRef.current) timeRef.current.textContent = `${fmt(t)} / ${fmt(duration)}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [player, duration]);

  // Only render the WebGL scene while on screen (result page has other content).
  useEffect(() => {
    const el = rootRef.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (!visible && !player.paused) player.pause(); }, [visible, player]);

  const playMoment = useCallback(id => {
    const m = moments.find(x => x.id === id); if (!m) return;
    player.seek(Math.max(0, m.time - .6));
    player.speed = .25;
    player.stopAt = Math.min(player.duration, m.time + 1.2);
    player.paused = false; player.lastWall = performance.now(); player.emit();
    onSeek?.(player.clock);
    const n = moments.indexOf(m);
    setCaption({ key: Date.now(), num: CIRCLED[n] || n + 1, title: m.title || tr("关键时刻 {0}", [n + 1]) });
    clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setCaption(null), 2600);
  }, [moments, player, onSeek]);

  useImperativeHandle(ref, () => ({
    seek: t => { player.seek(t); onSeek?.(player.clock); },
    playMoment,
    pause: () => player.pause(),
    play: () => player.play(),
  }), [player, playMoment, onSeek]);

  useEffect(() => { if (activeMoment != null) playMoment(activeMoment); }, [activeMoment]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(captionTimer.current), []);

  // Scrubbing
  const tAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };
  const onDown = e => {
    if (e.target.closest('.ks-rv-moment')) return;
    trackRef.current.setPointerCapture?.(e.pointerId);
    drag.current = { wasPlaying: !player.paused };
    player.pause();
    const t = tAt(e.clientX); player.seek(t); onSeek?.(player.clock);
  };
  const onMove = e => { if (!drag.current) return; const t = tAt(e.clientX); player.seek(t); onSeek?.(player.clock); };
  const onUp = e => {
    if (!drag.current) return;
    trackRef.current.releasePointerCapture?.(e.pointerId);
    if (drag.current.wasPlaying) player.play();
    drag.current = null;
  };

  const ticks = useMemo(() => {
    const step = duration > 20 ? 5 : duration > 8 ? 2 : 1, out = [];
    for (let t = 0; t <= duration + 1e-6; t += step / 2) out.push({ t, major: Math.abs(t / step - Math.round(t / step)) < 1e-6 });
    return out;
  }, [duration]);
  const collisions = useMemo(() => events.filter(e => e.type === 'collision'), [events]);
  const finish = events.find(e => e.type === 'finish');

  const toggle = () => (player.paused ? player.play() : player.pause());
  const slow = () => player.setSpeed(player.speed < 1 ? 1 : .25);
  const replay = () => { player.seek(0); player.speed = 1; player.play(); onSeek?.(0); };

  return (
    <div ref={rootRef} className={`ks-rv ${className}`} style={style}>
      <div className="ks-rv-stage" style={{ height }}>
        {samples.length > 1 ? (
          <BattleScene player={player} frameloop={visible ? 'always' : 'never'} style={{ position: 'absolute', inset: 0 }}>
            {ui.speed < 1 && <div className="ks-rv-slowtag">¼× SLOW</div>}
            {caption && (
              <div key={caption.key} className="ks-rv-caption">
                <span className="ks-rv-caption-num">{caption.num}</span>
                <span className="ks-rv-caption-title">{caption.title}</span>
              </div>
            )}
          </BattleScene>
        ) : <div className="ks-rv-empty">{tr("没有回放数据")}</div>}
      </div>
      <div className="ks-rv-bar">
        <div className="ks-rv-buttons">
          <button className="ks-rv-btn" onClick={toggle} aria-label={ui.paused ? tr("播放") : tr("暂停")}>{ui.paused ? '▶' : '⏸'}</button>
          <button className={`ks-rv-btn ${ui.speed < 1 ? 'on' : ''}`} onClick={slow}>{tr("¼× 慢动作")}</button>
          <button className="ks-rv-btn" onClick={replay}>{tr("⟲ 重播")}</button>
          <span ref={timeRef} className="ks-rv-time">0.0s</span>
        </div>
        <div ref={trackRef} className="ks-rv-track" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <Sparkline samples={samples} duration={duration} beys={beys} />
          {ticks.map(({ t, major }) => (
            <div key={t} className={`ks-rv-tick ${major ? 'major' : ''}`} style={{ left: `${(t / duration) * 100}%` }}>{major && <span style={t > duration * .94 ? { left: 'auto', right: 4 } : undefined}>{Math.round(t)}s</span>}</div>
          ))}
          {collisions.map((e, i) => (
            <div key={i} className="ks-rv-hit" title={tr("碰撞 {0}", [fmt(e.time)])} style={{ left: `${(e.time / duration) * 100}%`, width: 2 + 5 * (e.intensity ?? .5) }} />
          ))}
          {finish && <div className="ks-rv-finish" style={{ left: `${(finish.time / duration) * 100}%` }}>FIN</div>}
          {moments.map((m, i) => (
            <button key={m.id} className={`ks-rv-moment ${activeMoment === m.id ? 'active' : ''}`} style={{ left: `${(m.time / duration) * 100}%` }}
              title={m.title} onClick={() => playMoment(m.id)}>{CIRCLED[i] || i + 1}</button>
          ))}
          <div ref={headRef} className="ks-rv-head" />
        </div>
      </div>
    </div>
  );
});

export default ReplayViewer;
