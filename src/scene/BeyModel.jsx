import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { specFromBey, wingOutline } from '../physics/model.js';
import { INK, toonMat, emblemTexture, ratchetTexture, spinBlurTexture } from './toon.js';
import { BEYS } from '../game/beys.js';

// Procedural Beyblade X–style top. Physics units (meters), spin axis +Z, blade plane z≈0,
// tip at z = -spec.tipDepth. Wing silhouettes come from wingOutline() = the physics hulls.

const Z_UP = new THREE.Matrix4().makeRotationX(Math.PI / 2); // Y-up primitives -> Z-up
// VISUAL spin rate caps (rev/s at >= 5000 rpm). Physics is untouched; the blur disc sells real speed.
export const BATTLE_REVS = 3.0;   // in-battle / launch stage
export const SHOWCASE_REVS = 1.25; // menus, title, cards — slow enough to read the blade

function shapeFrom(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

function buildGeometry(spec, bey) {
  const wings = [[], []], accents = [[], []];
  for (let i = 0; i < spec.wings; i++) {
    const pts = wingOutline(spec, i);
    const g = new THREE.ExtrudeGeometry(shapeFrom(pts), {
      depth: .0058, bevelEnabled: true, bevelThickness: .0007, bevelSize: .0006, bevelSegments: 1, curveSegments: 4,
    });
    g.translate(0, 0, -.0029);
    wings[i % 2].push(g);
    // Raised inner accent plate, scaled toward the wing centroid.
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const inner = pts.map(([x, y]) => [cx + (x - cx) * .6, cy + (y - cy) * .6]);
    const a = new THREE.ExtrudeGeometry(shapeFrom(inner), { depth: .0012, bevelEnabled: false });
    a.translate(0, 0, .0034);
    accents[i % 2].push(a);
    // Forward "fang" edge strip along the leading edge for attack/balance blades.
    if (spec.style === 'attack' || spec.style === 'balance') {
      const lead = pts.slice(Math.floor(pts.length / 2) - 1, Math.floor(pts.length / 2) + 1);
      if (lead.length === 2) {
        const [p0, p1] = lead, dir = new THREE.Vector2(p1[0] - p0[0], p1[1] - p0[1]);
        const len = dir.length(), mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        const fang = new THREE.BoxGeometry(len * .9, .0016, .0074);
        fang.rotateZ(Math.atan2(dir.y, dir.x));
        fang.translate(mid[0] * .985, mid[1] * .985, 0);
        accents[i % 2].push(fang);
      }
    }
  }
  const merge = list => {
    if (!list.length) return null;
    const m = mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)));
    m.computeVertexNormals();
    return m;
  };
  const wingGeo = [merge(wings[0]), merge(wings[1])], accentGeo = [merge(accents[0]), merge(accents[1])];

  // Core disc (matches physics cylinder r=18.5 mm, ±4 mm)
  const core = new THREE.CylinderGeometry(.0185, .0185, .008, 48).applyMatrix4(Z_UP);
  // Metal ring on top
  const mp = [[.0138, .0038], [.0176, .0038], [.0179, .0045], [.0174, .0055], [.0141, .0055], [.0136, .0047], [.0138, .0038]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  const metal = new THREE.LatheGeometry(mp, 64).applyMatrix4(Z_UP);
  metal.computeVertexNormals();
  // Metal ring "teeth" notches (purely decorative bumps)
  const notches = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.BoxGeometry(.0018, .0012, .0008);
    b.translate(.0157, 0, .0059);
    b.rotateZ(i * Math.PI / 6);
    notches.push(b);
  }
  const notchGeo = mergeGeometries(notches);
  // Lock chip
  const chip = new THREE.CylinderGeometry(.0108, .0112, .0026, 40).applyMatrix4(Z_UP);
  chip.translate(0, 0, .0053);

  // Ratchet: z -.004 .. -.0105
  const rTop = -.004, rH = .0065;
  const ratchet = new THREE.CylinderGeometry(.0102, .0108, rH, 36, 1, false).applyMatrix4(Z_UP);
  ratchet.translate(0, 0, rTop - rH / 2);
  const prongs = [], n = bey?.ratchet?.prongs || 3;
  for (let i = 0; i < n; i++) {
    const b = new THREE.BoxGeometry(.0042, .0046, rH * .7);
    b.translate(.0118, 0, rTop - rH * .45);
    b.rotateZ(i * 2 * Math.PI / n);
    prongs.push(b);
  }
  const prongGeo = mergeGeometries(prongs);

  // Bit: gear collar + tip lathe
  const bTop = rTop - rH, tip = spec.tipDepth;
  const collar = new THREE.CylinderGeometry(.0068, .0062, .0028, 28).applyMatrix4(Z_UP);
  collar.translate(0, 0, bTop - .0014);
  const gears = [];
  for (let i = 0; i < 16; i++) {
    const b = new THREE.BoxGeometry(.0016, .0012, .0022);
    b.translate(.0071, 0, bTop - .0016);
    b.rotateZ(i * Math.PI / 8);
    gears.push(b);
  }
  const gearGeo = mergeGeometries(gears);
  const z0 = bTop - .0028, T = -tip;
  const profiles = {
    needle: [[0, T], [.0009, T + .0006], [.0032, z0 - .0022], [.0046, z0]],
    ball: [[0, T], [.0011, T + .0003], [.0019, T + .0012], [.0022, T + .0024], [.0044, z0 - .0012], [.0048, z0]],
    flat: [[0, T], [.0029, T], [.0032, T + .0007], [.0042, z0 - .0014], [.0048, z0]],
    rush: [[0, T], [.0033, T], [.0037, T + .0012], [.0046, z0 - .0012], [.0052, z0]],
  };
  const prof = (profiles[spec.tip] || profiles.ball).map(([r, z]) => new THREE.Vector2(r, z));
  prof.push(new THREE.Vector2(0, z0));
  const bit = new THREE.LatheGeometry(prof, 32).applyMatrix4(Z_UP);
  bit.computeVertexNormals();

  return { wingGeo, accentGeo, core, metal, notchGeo, chip, ratchet, prongGeo, collar, gearGeo, bit };
}

const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  return '#' + c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k))).getHexString();
};

/**
 * <BeyModel bey rpm? rpmRef? spinning? blur? outline? maxRevs? blurStrength? />
 * - rpm / rpmRef.current: drives visual spin + blur (abs value; sign = direction)
 * - spinning: when no rpm given, a gentle showcase spin
 */
export default function BeyModel({ bey, rpm, rpmRef, spinning = false, blur = true, outline = true, outlineWidth = 2.6, maxRevs = BATTLE_REVS, blurStrength = 1 }) {
  const dpr = useThree(st => st.viewport.dpr);
  const ow = outlineWidth * dpr;
  const spec = useMemo(() => specFromBey(bey), [bey]);
  const geo = useMemo(() => buildGeometry(spec, bey), [spec, bey]);
  const spinRef = useRef(), blurRef = useRef(), ghostRef = useRef();
  const colors = bey?.colors || { primary: '#888', secondary: '#eee', accent: '#fff' };
  // Fused beys (bey.parents = [idA, idB]): alternate wings in the two parents' primary colours.
  const fusion = useMemo(() => {
    const ps = Array.isArray(bey?.parents) ? bey.parents : [];
    if (ps.length < 2) return null;
    const a = BEYS[ps[0]]?.colors?.primary || colors.primary;
    let b = BEYS[ps[1]]?.colors?.primary || colors.secondary;
    if (b === a) b = colors.accent !== a ? colors.accent : colors.secondary;
    return [a, b];
  }, [bey, colors.primary, colors.secondary, colors.accent]);

  const mats = useMemo(() => {
    const emblem = emblemTexture(bey, fusion);
    const label = `${bey?.ratchet?.prongs || 3}-${spec.height}`;
    const rtex = ratchetTexture(label);
    const chipSide = toonMat(INK);
    const chipTop = new THREE.MeshBasicMaterial({ map: emblem });
    return {
      wing: [toonMat(fusion ? fusion[0] : colors.primary), toonMat(fusion ? fusion[1] : colors.primary)],
      accent: [toonMat(fusion ? fusion[1] : colors.accent), toonMat(fusion ? fusion[0] : colors.accent)],
      fang: toonMat('#c9d1db', { metal: true }),
      core: toonMat(shade(colors.primary, .6)),
      metal: toonMat('#8e98a6', { metal: true }),
      notch: toonMat('#2b2f36'),
      chip: [chipSide, chipTop, chipSide],
      ratchet: [new THREE.MeshToonMaterial({ map: rtex, gradientMap: toonMat('#fff').gradientMap }), toonMat('#33363d'), toonMat('#33363d')],
      prong: toonMat('#2a2c31'),
      collar: toonMat(colors.accent),
      gear: toonMat(shade(colors.accent, .7)),
      bit: toonMat(spec.tip === 'rush' ? '#26282c' : colors.secondary),
      blur: new THREE.MeshBasicMaterial({ map: spinBlurTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      ghost: new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, opacity: 0, depthWrite: false }),
    };
  }, [bey, spec, fusion, colors.primary, colors.secondary, colors.accent]);

  const blurGeo = useMemo(() => new THREE.RingGeometry(.006, spec.reach * 1.06, 48, 1), [spec.reach]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 20);
    const r = rpmRef ? rpmRef.current : rpm;
    const has = Number.isFinite(r);
    const mag = has ? Math.abs(r) : (spinning ? 600 : 0);
    const dir = has && r < 0 ? -1 : 1;
    // Visual spin: slow enough not to alias badly; the blur disc sells the speed.
    const revPerSec = has ? maxRevs * Math.min(1, mag / 5000) : (spinning ? .35 : 0);
    if (spinRef.current) spinRef.current.rotation.z += dir * revPerSec * Math.PI * 2 * d;
    const k = blur && has ? THREE.MathUtils.clamp((mag - 600) / 3800, 0, 1) : 0;
    if (blurRef.current) {
      blurRef.current.rotation.z += dir * 2.39; // shimmering streaks
      mats.blur.opacity = .85 * k * blurStrength;
      blurRef.current.visible = k > .01;
    }
    if (ghostRef.current) {
      mats.ghost.opacity = .28 * k * blurStrength;
      ghostRef.current.visible = k > .01;
    }
  });

  const O = outline ? <Outlines thickness={ow} color={INK} /> : null;
  return (
    <group>
      <group ref={spinRef}>
        {[0, 1].map(k => geo.wingGeo[k] && <mesh key={'w' + k} geometry={geo.wingGeo[k]} material={mats.wing[k]}>{O}</mesh>)}
        {[0, 1].map(k => geo.accentGeo[k] && <mesh key={'a' + k} geometry={geo.accentGeo[k]} material={mats.accent[k]}>{outline ? <Outlines thickness={ow * .6} color={INK} /> : null}</mesh>)}
        <mesh geometry={geo.core} material={mats.core}>{O}</mesh>
        <mesh geometry={geo.metal} material={mats.metal}>{O}</mesh>
        <mesh geometry={geo.notchGeo} material={mats.notch} />
        <mesh geometry={geo.chip} material={mats.chip}>{O}</mesh>
        <mesh geometry={geo.ratchet} material={mats.ratchet}>{O}</mesh>
        <mesh geometry={geo.prongGeo} material={mats.prong}>{O}</mesh>
        <mesh geometry={geo.collar} material={mats.collar}>{O}</mesh>
        <mesh geometry={geo.gearGeo} material={mats.gear} />
        <mesh geometry={geo.bit} material={mats.bit}>{O}</mesh>
      </group>
      <mesh ref={ghostRef} geometry={blurGeo} material={mats.ghost} position={[0, 0, .0072]} visible={false} />
      <mesh ref={blurRef} geometry={blurGeo} material={mats.blur} position={[0, 0, .0076]} visible={false} renderOrder={2} />
    </group>
  );
}
