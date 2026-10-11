import { floorHeight, specFromBey } from '../physics/model.js';

// Fake playback implementing the contract's player interface, for art work without the worker.
// Two beys orbit, cross paths periodically (collision events), dash on the rim, finish at ~12 s.
export function createMockPlayer({ beys, duration = 12, loop = true, finishReason = 'xtreme' } = {}) {
  const specs = beys.map(b => specFromBey(b));
  const start = performance.now();
  const events = [];
  const pos = (i, t) => {
    const w = i ? -1.9 : 2.3, ph = i ? Math.PI : 0;
    const r = .1 + .045 * Math.sin(t * (i ? 1.3 : 1.7) + i) + (i === 1 && t > duration - 1.2 ? (t - (duration - 1.2)) * .2 : 0);
    const a = w * t + ph;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    return [x, y, floorHeight(x, y) + specs[i].tipDepth];
  };
  // collisions where the two paths are closest (sampled)
  let last = -1;
  for (let t = .3; t < duration - .2; t += 1 / 60) {
    const a = pos(0, t), b = pos(1, t), d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d < .07 && t - last > .9) {
      events.push({ time: +t.toFixed(3), type: 'collision', point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], intensity: Math.min(1, .35 + Math.random() * .7), relSpeed: .8 + Math.random() });
      last = t;
    }
  }
  for (let t = 1.5; t < duration; t += 3.1) events.push({ time: +t.toFixed(3), type: 'dash', body: Math.round(t) % 2 });
  events.push({ time: duration, type: 'finish', winner: 0, reason: finishReason, points: 3 });
  events.sort((a, b) => a.time - b.time);

  const getTime = () => {
    const t = (performance.now() - start) / 1000;
    return loop ? t % (duration + 3) : Math.min(t, duration + 3);
  };
  const getState = t => {
    const tc = Math.min(t, duration);
    return {
      time: t,
      bodies: specs.map((s, i) => {
        const p = pos(i, tc);
        const tilt = (i ? .12 : .08) + (i === 1 && t > duration - .8 ? Math.min(1.2, (t - duration + .8) * 2) : 0);
        const pa = tc * 3.1 + i;
        const ax = [Math.sin(tilt) * Math.cos(pa), Math.sin(tilt) * Math.sin(pa)];
        // quaternion rotating +Z to the tilted axis (no spin component)
        const h = Math.cos(tilt / 2), sn = Math.sin(tilt / 2), n = Math.hypot(ax[0], ax[1]) || 1;
        const q = [h, -ax[1] / n * sn, ax[0] / n * sn, 0];
        const rpm = Math.max(0, 5200 - tc * (i ? 260 : 180) - (i === 1 && t > duration ? 9999 : 0));
        return { p, q, rpm, tilt: tilt * 180 / Math.PI };
      }),
    };
  };
  return { getTime, getState, events, beys, ended: false };
}
