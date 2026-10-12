import {tr} from '../i18n/index.js';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { floorHeight } from '../physics/model.js';
import BeyModel from './BeyModel.jsx';
import Stadium from './Stadium.jsx';
import { blobShadowTexture } from './toon.js';
import './scene.css';

const S = 10; // physics meters -> scene units
export const SIDE_COLORS = ['#2f7bff', '#ff9f1a']; // me / opponent — same as the HUD plates
const INTRO = .42; // visual drop-in duration (s); physics unchanged
const toWorld = (p, out = new THREE.Vector3()) => out.set(p[0] * S, p[2] * S, -p[1] * S);
const Z = new THREE.Vector3(0, 0, 1);

// ---------- one bey: position + tilt from physics, visual spin from rpm, floor shadow, ground trail
function BeyActor({ player, index, fx }) {
  const bey = player.beys[index];
  const posRef = useRef(), tiltRef = useRef(), shadowRef = useRef(), rpmRef = useRef(0), lastT = useRef(0), seekV = useRef(0);
  const trail = useMemo(() => {
    const N = 42, pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    return { N, g, pts: [], color: new THREE.Color(bey.colors?.accent || '#fff') };
  }, [bey]);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity: .7, depthWrite: false }), []);
  const ringRef = useRef();
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SIDE_COLORS[index] || '#fff', transparent: true, opacity: .9, depthWrite: false, toneMapped: false }), [index]);
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const axis = useMemo(() => new THREE.Vector3(), []), q = useMemo(() => new THREE.Quaternion(), []), tq = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const t = player.getTime();
    const st = player.getState(t);
    const b = st?.bodies?.[index];
    if (!b || !posRef.current) return;
    const drop = t < INTRO ? Math.pow(1 - t / INTRO, 2) : 0;
    posRef.current.position.set(b.p[0], b.p[1], b.p[2] + drop * .085);
    // tilt only: rotate +Z onto the physics spin axis
    q.set(b.q[1], b.q[2], b.q[3], b.q[0]);
    axis.copy(Z).applyQuaternion(q);
    tq.setFromUnitVectors(Z, axis);
    tiltRef.current.quaternion.copy(tq);
    rpmRef.current = b.rpm;
    const fh = floorHeight(b.p[0], b.p[1]);
    const h = Math.max(0, b.p[2] - fh);
    shadowRef.current.position.set(b.p[0] + .004, b.p[1] - .004, fh + .0008);
    if (ringRef.current) { ringRef.current.position.set(b.p[0], b.p[1], fh + .0016); ringMat.opacity = .9 * (1 - drop); }
    const sc = .075 * (1 + h * 8) * (1 - drop * .5);
    shadowRef.current.scale.set(sc, sc, 1);
    shadowMat.opacity = Math.max(0, .7 - h * 6) * (1 - drop * .6);
    // ground trail
    const dashing = fx.current.dash[index] > t;
    const pts = trail.pts;
    const lastP = pts[pts.length - 1];
    if (!lastP || Math.hypot(lastP[0] - b.p[0], lastP[1] - b.p[1]) > .0025) pts.push([b.p[0], b.p[1], fh + .0012]);
    if (t < lastT.current - .05 || (player.seekVersion || 0) !== seekV.current) { pts.length = 0; seekV.current = player.seekVersion || 0; } // rewound / seeked
    lastT.current = t;
    while (pts.length > trail.N) pts.shift();
    const pos = trail.g.attributes.position.array, col = trail.g.attributes.color.array;
    const n = pts.length, w = dashing ? .016 : .009;
    for (let i = 0; i < trail.N; i++) {
      const k = Math.min(i, n - 1), p = pts[Math.max(0, k)] || [b.p[0], b.p[1], fh];
      const pn = pts[Math.min(n - 1, k + 1)] || p, pp = pts[Math.max(0, k - 1)] || p;
      let dx = pn[0] - pp[0], dy = pn[1] - pp[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const f = n > 1 ? k / (n - 1) : 0, ww = w * f;
      pos.set([p[0] - dy * ww, p[1] + dx * ww, p[2], p[0] + dy * ww, p[1] - dx * ww, p[2]], i * 6);
      const a = i < n ? Math.pow(f, 1.6) * (dashing ? 1 : .75) : 0;
      const c = dashing ? [2.6, 2.3, 1.4] : [trail.color.r, trail.color.g, trail.color.b];
      col.set([...c, a, ...c, a], i * 8);
    }
    trail.g.attributes.position.needsUpdate = true; trail.g.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={trail.g} material={trailMat} renderOrder={1} frustumCulled={false} />
      <mesh ref={shadowRef} material={shadowMat}><planeGeometry args={[1, 1]} /></mesh>
      <mesh ref={ringRef} material={ringMat} renderOrder={2}><ringGeometry args={[.026, .033, 48]} /></mesh>
      <group ref={posRef}>
        <group ref={tiltRef}>
          <BeyModel bey={bey} rpmRef={rpmRef} />
        </group>
      </group>
    </>
  );
}

// ---------- sparks: instanced glowing shards + shock rings
function Sparks({ api }) {
  const N = 180;
  const mesh = useRef(), rings = useRef([]);
  const data = useMemo(() => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1 })), []);
  const geo = useMemo(() => new THREE.BoxGeometry(.009, .0014, .0014), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.2), toneMapped: false }), []);
  const ringMat = useMemo(() => Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.6), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(.8, 1, 48), []);
  const ringState = useMemo(() => Array.from({ length: 6 }, () => ({ t: 1, p: [0, 0, 0], s: 1 })), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []), qq = useMemo(() => new THREE.Quaternion(), []), sc = useMemo(() => new THREE.Vector3(), []);
  const X = useMemo(() => new THREE.Vector3(1, 0, 0), []), dir = useMemo(() => new THREE.Vector3(), []);
  let cursor = useRef(0), ringCursor = useRef(0);

  api.current.spawn = (point, intensity) => {
    const count = Math.round(18 + 50 * intensity);
    for (let i = 0; i < count; i++) {
      const s = data[cursor.current++ % N];
      s.p.set(point[0], point[1], point[2] + .004);
      const a = Math.random() * Math.PI * 2, up = .2 + Math.random() * .8, sp = (.25 + Math.random() * .75) * (.5 + intensity);
      s.v.set(Math.cos(a) * sp, Math.sin(a) * sp, up * sp);
      s.max = s.life = .14 + Math.random() * .26;
    }
    api.current.ring(point, .02 + .05 * intensity);
  };
  api.current.ring = (point, size) => {
    const r = ringState[ringCursor.current++ % ringState.length];
    r.t = 0; r.p = point; r.s = size;
  };

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 30);
    const im = mesh.current; if (!im) return;
    for (let i = 0; i < N; i++) {
      const s = data[i];
      if (s.life > 0) {
        s.life -= d; s.v.z -= 4 * d; s.v.multiplyScalar(1 - 3.5 * d); s.p.addScaledVector(s.v, d);
        dir.copy(s.v).normalize(); qq.setFromUnitVectors(X, dir);
        const k = Math.max(0, s.life / s.max), len = .5 + s.v.length() * 1.6;
        sc.set(len * k + .1, k, k);
        m4.compose(s.p, qq, sc);
      } else m4.makeScale(0, 0, 0);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    ringState.forEach((r, i) => {
      const m = rings.current[i]; if (!m) return;
      r.t += d / .32;
      const k = Math.min(1, r.t);
      m.visible = k < 1;
      m.position.set(r.p[0], r.p[1], r.p[2]);
      const s = r.s * (.3 + k * 1.4); m.scale.set(s, s, s);
      ringMat[i].opacity = (1 - k) * .9;
    });
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
      {ringMat.map((m, i) => <mesh key={i} ref={el => (rings.current[i] = el)} geometry={ringGeo} material={m} visible={false} />)}
    </>
  );
}

// ---------- event dispatcher + camera rig
function Director({ player, fx, sparks, overlay, onEvent, flip }) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []), tmp = useMemo(() => new THREE.Vector3(), []), tmp2 = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(), []), dirV = useMemo(() => new THREE.Vector3(0, 3.7, flip ? -4.3 : 4.3).normalize(), [flip]);
  const shake = useRef(0), punch = useRef(0), idx = useRef(0), launched = useRef(false), seekV = useRef(0);

  useFrame((_, dt) => {
    const t = player.getTime();
    const f = fx.current;
    if (t < f.lastT - .05) { idx.current = 0; f.dash = [-1, -1]; launched.current = false; overlay.current?.reset(); }
    if ((player.seekVersion || 0) !== seekV.current) {
      // Jumped (replay scrub): resync without firing effects for skipped events.
      seekV.current = player.seekVersion || 0;
      const ev0 = player.events || [];
      let k = 0; while (k < ev0.length && ev0[k].time <= t) k++;
      idx.current = k; f.dash = [-1, -1]; launched.current = t >= INTRO * .92;
      overlay.current?.reset();
    }
    if (!launched.current && t >= INTRO * .92) {
      launched.current = true;
      const st0 = player.getState(t);
      st0?.bodies?.forEach(b => sparks.current.ring?.([b.p[0], b.p[1], b.p[2] - .012], .07));
      shake.current = Math.max(shake.current, .05);
    }
    f.lastT = t;
    const ev = player.events || [];
    while (idx.current < ev.length && ev[idx.current].time <= t) {
      const e = ev[idx.current++];
      if (t - e.time > .5 && e.type !== 'finish') continue; // skip stale effects after seeking
      if (e.type === 'collision') {
        const I = e.intensity ?? .5;
        sparks.current.spawn?.(e.point, I);
        shake.current = Math.max(shake.current, .02 + .09 * I);
        toWorld(e.point, tmp).project(camera);
        overlay.current?.impact((tmp.x * .5 + .5) * size.width, (-tmp.y * .5 + .5) * size.height, I);
      } else if (e.type === 'dash') {
        f.dash[e.body] = e.time + .6;
        overlay.current?.dash(e.body);
      } else if (e.type === 'finish') {
        punch.current = 1;
        shake.current = .12;
        overlay.current?.finish(e);
      }
      onEvent?.(e);
    }
    // follow midpoint of the action
    const st = player.getState(t);
    if (st?.bodies?.length) {
      tmp.set(0, 0, 0);
      st.bodies.forEach(b => tmp.add(toWorld(b.p, tmp2)));
      tmp.multiplyScalar(1 / st.bodies.length * .18);
      target.lerp(tmp, 1 - Math.exp(-dt * 2.5));
    }
    const d = Math.min(dt, 1 / 30);
    shake.current *= Math.exp(-d * 7);
    punch.current *= Math.exp(-d * 2.2);
    // Fit the whole stadium (radius ~2.45 units incl. shell) for the current aspect ratio.
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const elev = Math.asin(dirV.y), Rv = 2.45 * Math.sin(elev) + .55 * Math.cos(elev), Rh = 2.5;
    const dist = Math.max(Rv / Math.tan(vf), Rh / Math.tan(hf)) + .35;
    base.copy(dirV).multiplyScalar(dist);
    const s = shake.current;
    camera.position.copy(base).add(target).multiplyScalar(1).addScaledVector(tmp.set(0, -.55, flip ? .9 : -.9), punch.current * .9);
    camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s;
    camera.lookAt(target.x + (Math.random() - .5) * s * .4, target.y - .1, target.z);
  });
  return null;
}

// ---------- HTML overlay: manga SFX, flashes, finish banner
const SFX_BIG = ['ドガァン！', tr("轰！！"), 'ズドン！'], SFX_MID = ['ガキン！', tr("锵！"), 'ガッ！'], SFX_SMALL = ['カッ', tr("叮！"), 'キン'];
const FINISH = {
  xtreme: { en: 'XTREME FINISH!', zh: tr("极限终结"), pts: 3 },
  over: { en: 'OVER FINISH!', zh: tr("出界终结"), pts: 2 },
  burst: { en: 'BURST FINISH!', zh: tr("爆裂终结"), pts: 2 },
  spin: { en: 'SPIN FINISH!', zh: tr("停转终结"), pts: 1 },
  judge: { en: 'JUDGE!', zh: tr("时间到 · 转速判定"), pts: 1 },
};
const Overlay = forwardRef(function Overlay({ beys }, ref) {
  const [items, setItems] = useState([]);
  const [flash, setFlash] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [finish, setFinish] = useState(null);
  const id = useRef(0);
  useImperativeHandle(ref, () => ({
    impact(x, y, I) {
      const list = I > .72 ? SFX_BIG : I > .4 ? SFX_MID : SFX_SMALL;
      const it = { id: id.current++, x, y, I, text: list[Math.floor(Math.random() * list.length)], rot: (Math.random() - .5) * 26 };
      setItems(a => [...a.slice(-4), it]);
      setTimeout(() => setItems(a => a.filter(b => b.id !== it.id)), 900);
      if (I > .55) { setFlash(f => f + 1); }
      if (I > .35) setSpeed(k => k + 1);
    },
    dash() {},
    finish(e) { setFinish(e); setFlash(f => f + 1); },
    reset() { setItems([]); setFinish(null); },
  }), []);
  const fin = finish && (FINISH[finish.reason] || FINISH.spin);
  const winner = finish && beys?.[finish.winner];
  return (
    <div className="ks-overlay">
      {flash > 0 && <div key={'f' + flash} className="ks-flash" />}
      {speed > 0 && <div key={'s' + speed} className="ks-speedflash" />}
      {items.map(it => (
        <div key={it.id} className="ks-impact" style={{ left: it.x, top: it.y }}>
          <div className="ks-burst" style={{ transform: `translate(-50%,-50%) scale(${.6 + it.I})` }} />
          <div className="ks-sfx" style={{ fontSize: 34 + it.I * 64, '--rot': `${it.rot}deg` }}>{it.text}</div>
        </div>
      ))}
      {fin && (
        <div className={`ks-finish ks-finish-${finish.reason}`}>
          <div className="ks-finish-lines" />
          <div className="ks-finish-en">{fin.en}</div>
          <div className="ks-finish-zh">{fin.zh}{winner ? tr(" · {0} 胜", [winner.name]) : ''} <span className="ks-finish-pts">{tr("+1 局")}</span></div>
        </div>
      )}
    </div>
  );
});

/**
 * <BattleScene player={player} onEvent? overlay? style? className? frameloop? children? />
 * player.seekVersion (optional number): bump it on a jump/seek so skipped events don't fire effects.
 * player: { getTime(), getState(t), events[], beys[] } (see CONTRACT.md)
 */
// flip (optional): view the stadium from the opposite side (online slot 1 sees its own bey on the left, like slot 0). Camera only.
export default function BattleScene({ player, onEvent, overlay = true, className = '', style, frameloop = 'always', children, flip = false }) {
  const fx = useRef({ dash: [-1, -1], lastT: 0 });
  const sparks = useRef({}), overlayRef = useRef(null);
  if (!player) return <div className={`ks-battle ${className}`} style={style} />;
  return (
    <div className={`ks-battle ${className}`} style={style}>
      <div className="ks-battle-bg" />
      <Canvas
        flat
        frameloop={frameloop}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, near: .05, far: 60, position: [0, 3.55, flip ? -4.35 : 4.35] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={.85} />
        <directionalLight position={[2.5, 6, 3]} intensity={1.7} />
        <directionalLight position={[-4, 2, -3]} intensity={.6} color="#bcd4ff" />
        <group rotation-x={-Math.PI / 2} scale={S}>
          <Stadium />
          {player.beys.map((_, i) => <BeyActor key={i} index={i} player={player} fx={fx} />)}
          <Sparks api={sparks} />
        </group>
        <Director player={player} fx={fx} sparks={sparks} overlay={overlayRef} onEvent={onEvent} flip={flip} />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1.7} luminanceSmoothing={.1} intensity={1.4} radius={.6} />
          <Vignette eskil={false} offset={.32} darkness={.38} />
        </EffectComposer>
      </Canvas>
      {overlay && <Overlay ref={overlayRef} beys={player.beys} />}
      {children}
    </div>
  );
}
