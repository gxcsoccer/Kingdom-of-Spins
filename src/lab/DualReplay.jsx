import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import BattleScene from '../scene/BattleScene.jsx';
import { createReplayPlayer } from '../scene/ReplayViewer.jsx';

// Two replays (A original / B modified) on ONE shared clock, so kids see where the runs diverge.
function createSharedClock(players) {
  const end = Math.max(...players.map(p => p.duration || 0), .01);
  const subs = new Set();
  const c = {
    clock: 0, speed: 1, paused: true, lastWall: null, end,
    emit() { subs.forEach(f => f(c)); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    tick() {
      const now = performance.now();
      if (!c.paused && c.lastWall != null) {
        c.clock = Math.min(end, c.clock + Math.min(.1, (now - c.lastWall) / 1000) * c.speed);
        if (c.clock >= end) { c.paused = true; c.emit(); }
      }
      c.lastWall = now;
      return c.clock;
    },
    play() { if (c.clock >= end - 1e-3) c.seek(0); c.paused = false; c.lastWall = performance.now(); c.emit(); },
    pause() { c.tick(); c.paused = true; c.emit(); },
    setSpeed(x) { c.tick(); c.speed = x; c.emit(); },
    seek(t) { c.clock = Math.max(0, Math.min(end, t)); c.lastWall = performance.now(); players.forEach(p => p.seekVersion++); c.emit(); },
  };
  // Each side follows the shared clock but holds at its own end (its finish banner stays up).
  players.forEach(p => { p.getTime = () => Math.min(c.tick(), p.duration); });
  return c;
}

function Side({ label, tone, player, visible, rpmRef, kidName }) {
  return (
    <div className="dr-side">
      <div className={`dr-label ${tone}`}>{label}</div>
      <div className="dr-stage">
        <BattleScene player={player} frameloop="always" style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div className="dr-rpm">
        <span className="dr-rpm-n">{kidName}</span>
        <div className="dr-rpm-bar"><i ref={el => (rpmRef.current.bar = el)} /></div>
        <span className="dr-rpm-v" ref={el => (rpmRef.current.val = el)}>0 rpm</span>
      </div>
    </div>
  );
}

/**
 * <DualReplay beysA={[mine, opp]} beysB={[variant, opp]} fullA={{samples, events}} fullB={{samples, events}} height? />
 */
// First time the two runs clearly differ (kid's bey position > 2.5 cm apart or rpm > 12% apart).
function divergence(a = [], b = []) {
  const n = Math.min(a.length, b.length), r0 = Math.abs(a[0]?.bodies?.[0]?.rpm || 1);
  for (let i = 0; i < n; i++) {
    if (a[i].time < .3) continue; // ignore launch jitter
    const pa = a[i].bodies[0], pb = b[i].bodies[0];
    if (Math.hypot(pa.p[0] - pb.p[0], pa.p[1] - pb.p[1]) > .025 || Math.abs(Math.abs(pa.rpm) - Math.abs(pb.rpm)) > r0 * .12) return a[i].time;
  }
  return null;
}

/**
 * ref: jumpDivergence() — ¼× from just before the first difference; replayFromStart(); pause()
 */
const DualReplay = forwardRef(function DualReplay({ beysA, beysB, fullA, fullB, height = 300, labels = ['A 原版', 'B 改装'], autoplay = false }, ref) {
  const { pA, pB, clock } = useMemo(() => {
    const pA = createReplayPlayer({ beys: beysA, samples: fullA?.samples || [], events: fullA?.events || [] });
    const pB = createReplayPlayer({ beys: beysB, samples: fullB?.samples || [], events: fullB?.events || [] });
    return { pA, pB, clock: createSharedClock([pA, pB]) };
  }, [beysA, beysB, fullA, fullB]);
  const [ui, setUi] = useState({ paused: true, speed: 1 });
  const [cap, setCap] = useState(null);
  const tDiv = useMemo(() => divergence(fullA?.samples, fullB?.samples), [fullA, fullB]);
  const tHit = useMemo(() => [fullA, fullB].map(f => (f?.events || []).find(e => e.type === 'collision')?.time).filter(Number.isFinite).sort((x, y) => x - y)[0], [fullA, fullB]);
  const auto = useRef({ phase: 'off', shown: false });
  // Autoplay: ¼× slow-mo around the first collision, then 1× to the end.
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => {
      auto.current = { phase: 'slow', shown: false };
      const from = Number.isFinite(tHit) ? Math.max(0, tHit - .6) : 0;
      clock.seek(from); clock.speed = Number.isFinite(tHit) ? .25 : 1; clock.play();
    }, 500);
    return () => clearTimeout(t);
  }, [autoplay, clock, tHit]);
  useImperativeHandle(ref, () => ({
    jumpDivergence() {
      const t = tDiv ?? tHit ?? 0;
      auto.current = { phase: 'slow', shown: false };
      clock.seek(Math.max(0, t - .8)); clock.speed = .25; clock.play();
    },
    replayFromStart() { auto.current = { phase: 'off', shown: true }; clock.seek(0); clock.speed = 1; clock.play(); },
    pause() { clock.pause(); },
  }), [clock, tDiv, tHit]);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef(), trackRef = useRef(), headRef = useRef(), timeRef = useRef();
  const rpmA = useRef({}), rpmB = useRef({}), drag = useRef(null);
  const maxRpm = useMemo(() => Math.max(1000, ...[fullA, fullB].flatMap(f => (f?.samples || []).map(s => Math.abs(s.bodies[0].rpm)))), [fullA, fullB]);

  useEffect(() => clock.subscribe(c => setUi({ paused: c.paused, speed: c.speed })), [clock]);
  useEffect(() => {
    let raf;
    const loop = () => {
      const t = clock.tick(); // drive the shared clock here, not only from canvas frames
      const au = auto.current;
      if (au.phase === 'slow' && Number.isFinite(tHit) && t > tHit + 1.2) { au.phase = 'normal'; clock.setSpeed(1); }
      if (tDiv != null && !au.shown && au.phase !== 'off' && t >= tDiv) { au.shown = true; setCap({ key: Date.now() }); setTimeout(() => setCap(null), 2800); }
      if (headRef.current) headRef.current.style.left = `${(t / clock.end) * 100}%`;
      if (timeRef.current) timeRef.current.textContent = `${t.toFixed(1)}s / ${clock.end.toFixed(1)}s`;
      for (const [p, r] of [[pA, rpmA], [pB, rpmB]]) {
        const st = p.getState(Math.min(t, p.duration)), rpm = Math.abs(st?.bodies?.[0]?.rpm || 0);
        if (r.current.bar) { r.current.bar.style.width = `${Math.min(100, (rpm / maxRpm) * 100)}%`; r.current.bar.style.background = rpm < 1200 ? '#ff2d4a' : '#ffd400'; }
        if (r.current.val) r.current.val.textContent = `${Math.round(rpm).toLocaleString()} rpm${t >= p.duration - 1e-3 && p.duration > 0 ? ' · 结束' : ''}`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clock, pA, pB, maxRpm, tHit, tDiv]);
  useEffect(() => {
    const el = rootRef.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el); return () => io.disconnect();
  }, []);

  const tAt = x => { const r = trackRef.current.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * clock.end; };
  const onDown = e => { trackRef.current.setPointerCapture?.(e.pointerId); drag.current = { was: !clock.paused }; clock.pause(); clock.seek(tAt(e.clientX)); };
  const onMove = e => { if (drag.current) clock.seek(tAt(e.clientX)); };
  const onUp = e => { if (!drag.current) return; trackRef.current.releasePointerCapture?.(e.pointerId); if (drag.current.was) clock.play(); drag.current = null; };

  const finA = (fullA?.events || []).find(e => e.type === 'finish'), finB = (fullB?.events || []).find(e => e.type === 'finish');
  if (!fullA?.samples?.length || !fullB?.samples?.length) return <div className="dr-empty">没有可回放的数据</div>;
  return (
    <div ref={rootRef} className="dr">
      <div className="dr-row" style={{ '--dr-h': `${height}px` }}>
        {cap && <div key={cap.key} className="dr-diverge">从这里开始不一样了！</div>}
        <Side label={labels[0]} tone="a" player={pA} visible={visible} rpmRef={rpmA} kidName={beysA[0]?.name} />
        <Side label={labels[1]} tone="b" player={pB} visible={visible} rpmRef={rpmB} kidName={beysB[0]?.name} />
      </div>
      <div className="dr-bar">
        <div className="ks-rv-buttons">
          <button className="ks-rv-btn" onClick={() => (clock.paused ? clock.play() : clock.pause())}>{ui.paused ? '▶ 同时播放' : '⏸ 暂停'}</button>
          <button className={`ks-rv-btn ${ui.speed < 1 ? 'on' : ''}`} onClick={() => clock.setSpeed(clock.speed < 1 ? 1 : .25)}>¼× 慢动作</button>
          <button className="ks-rv-btn" onClick={() => { auto.current = { phase: 'off', shown: false }; clock.seek(0); clock.speed = 1; clock.play(); }}>⟲ 重播</button>
          <span ref={timeRef} className="ks-rv-time">0.0s</span>
        </div>
        <div ref={trackRef} className="ks-rv-track dr-track" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {(fullA.events || []).filter(e => e.type === 'collision').map((e, i) => <div key={'a' + i} className="dr-hit a" style={{ left: `${(e.time / clock.end) * 100}%` }} />)}
          {(fullB.events || []).filter(e => e.type === 'collision').map((e, i) => <div key={'b' + i} className="dr-hit b" style={{ left: `${(e.time / clock.end) * 100}%` }} />)}
          {[[finA, 'a', 'A 结束'], [finB, 'b', 'B 结束']].map(([f, k, txt]) => f && (
            <div key={k} className={`dr-fin ${k} ${f.time > clock.end * .9 ? 'end' : ''}`} style={{ left: `${(f.time / clock.end) * 100}%` }}>{txt}</div>
          ))}
          {tDiv != null && <div className="dr-div-mark" style={{ left: `${(tDiv / clock.end) * 100}%` }} title="从这里开始不一样">⚡</div>}
          <div ref={headRef} className="ks-rv-head" />
        </div>
      </div>
    </div>
  );
});
export default DualReplay;
