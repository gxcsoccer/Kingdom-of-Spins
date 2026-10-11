import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, Outlines } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { floorHeight, specFromBey } from '../physics/model.js';
import BeyModel from './BeyModel.jsx';
import Stadium from './Stadium.jsx';
import { INK, toonMat } from './toon.js';
import './scene.css';

// 3D slingshot launch stage. Low camera behind the player's launch spot; drag anywhere to pull the
// bey back. Reports the pull in the SAME units/frame as the old top-down SVG slingshot
// (svg x = physics x, svg y = −physics y, 100 svg units ≈ 0.19 m) so slingToLaunch() is unchanged.
const S = 10, K = 100 / .19;
export const LAUNCH_SPOT = [-.09, 0];
const OPP_SPOT = [.09, 0];
const HOVER = .022;

function hoverZ(bey, x, y) { return floorHeight(x, y) + specFromBey(bey).tipDepth + HOVER; }

function CameraRig({ camRef, stateRef }) {
  const { camera, size } = useThree();
  const base = useMemo(() => new THREE.Vector3(), []), look = useMemo(() => new THREE.Vector3(.25, -.05, 0), []);
  useEffect(() => { camRef.current = camera; }, [camera, camRef]);
  useFrame((_, dt) => {
    const st = stateRef.current, aspect = size.width / size.height;
    const back = aspect < 1.25 ? 1.35 : 1; // narrow screens: pull the camera back
    base.set(-3.6 * back, 2.25 * back, 0);
    const p = st.power || 0, launched = st.launched;
    // creep in + lower while charging; punch forward on launch
    const k = launched ? Math.min(1, (performance.now() - launched.t0) / 350) : 0;
    camera.position.set(base.x + p * .35 + k * 1.1, base.y - p * .35 - k * .3, base.z);
    if (st.shake) { camera.position.x += (Math.random() - .5) * st.shake; camera.position.y += (Math.random() - .5) * st.shake; }
    camera.lookAt(look);
  });
  return null;
}

// Swirling aura particles + ground glow around the charging bey.
function Aura({ stateRef, groupRef }) {
  const N = 220;
  const pts = useRef(), ring = useRef();
  const data = useMemo(() => Array.from({ length: N }, () => ({ a: Math.random() * Math.PI * 2, r: .02 + Math.random() * .03, z: Math.random() * .06, v: .03 + Math.random() * .08 })), []);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: .006, color: new THREE.Color(3, 3, 3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const st = stateRef.current, p = Math.min(1.15, st.power || 0), g = groupRef.current;
    if (!g) return;
    col.set(st.aura || '#29b6ff');
    mat.color.setRGB(col.r * 3, col.g * 3, col.b * 3); ringMat.color.setRGB(col.r * 2.2, col.g * 2.2, col.b * 2.2);
    mat.opacity = st.launched ? 0 : Math.min(1, p * 1.4); mat.size = .004 + .006 * p;
    ringMat.opacity = st.launched ? 0 : p * .75;
    const arr = geo.attributes.position.array, d = Math.min(dt, 1 / 30);
    for (let i = 0; i < N; i++) {
      const q = data[i];
      q.a += d * (2 + 9 * p); q.z += d * q.v * (1 + 3 * p);
      if (q.z > .07 + .05 * p) { q.z = 0; q.r = .02 + Math.random() * (.025 + .03 * p); }
      const r = q.r * (1 + .6 * p);
      arr[i * 3] = g.position.x + r * Math.cos(q.a); arr[i * 3 + 1] = g.position.y + r * Math.sin(q.a); arr[i * 3 + 2] = g.position.z - .02 + q.z;
    }
    geo.attributes.position.needsUpdate = true;
    if (ring.current) { ring.current.position.set(g.position.x, g.position.y, floorHeight(g.position.x, g.position.y) + .001); const s = .035 + .03 * p + Math.sin(performance.now() / 70) * .003 * p; ring.current.scale.set(s, s, s); }
  });
  return (
    <>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <mesh ref={ring} material={ringMat}><ringGeometry args={[.75, 1, 48]} /></mesh>
    </>
  );
}

// Flowing chevrons on the floor showing the launch direction (length ~ power).
function AimArrow({ stateRef }) {
  const group = useRef(), mats = useRef([]);
  const shape = useMemo(() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-.012, .011); s.lineTo(-.007, .011); s.lineTo(.005, 0); s.lineTo(-.007, -.011); s.lineTo(-.012, -.011); s.closePath(); return new THREE.ShapeGeometry(s); }, []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const st = stateRef.current, g = group.current; if (!g) return;
    const show = st.dir && !st.launched && st.power > .05;
    g.visible = !!show; if (!show) return;
    col.set(st.aura || '#29b6ff');
    const ang = Math.atan2(-st.dir.y, st.dir.x); // svg y -> physics y
    const t = performance.now() / 1000, n = 6, len = .05 + .12 * Math.min(1, st.power);
    g.children.forEach((m, i) => {
      const f = ((i / n + t * 1.6) % 1), d = .03 + f * len;
      const x = LAUNCH_SPOT[0] + Math.cos(ang) * d, y = LAUNCH_SPOT[1] + Math.sin(ang) * d;
      m.position.set(x, y, floorHeight(x, y) + .0015); m.rotation.set(0, 0, ang);
      const mm = mats.current[i]; mm.color.setRGB(col.r * 2.4, col.g * 2.4, col.b * 2.4); mm.opacity = Math.sin(f * Math.PI) * .95;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={shape}>
          <meshBasicMaterial ref={el => (mats.current[i] = el)} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// The player's bey + launcher + ripcord.
function MyBey({ bey, stateRef, groupRef }) {
  const rpmRef = useRef(600), tilt = useRef(), cord = useRef();
  const z0 = useMemo(() => hoverZ(bey, ...LAUNCH_SPOT), [bey]);
  const body = useMemo(() => toonMat('#2b2f36'), []), grip = useMemo(() => toonMat('#ff2d4a'), []);
  useFrame(() => {
    const st = stateRef.current, g = groupRef.current; if (!g) return;
    const t = performance.now() / 1000, p = Math.min(1.15, st.power || 0);
    let x = LAUNCH_SPOT[0], y = LAUNCH_SPOT[1], z = z0 + Math.sin(t * 2.2) * .002;
    if (st.pull && !st.launched) { x += st.pull.x / K * .35; y += -st.pull.y / K * .35; }
    if (st.launched) {
      const k = Math.min(1, (performance.now() - st.launched.t0) / 380), e = k * k;
      const ang = Math.atan2(-st.launched.dir.y, st.launched.dir.x);
      x = st.launched.from[0] + Math.cos(ang) * .12 * e; y = st.launched.from[1] + Math.sin(ang) * .12 * e; z = z0 - HOVER * e;
    }
    g.position.set(x, y, z);
    rpmRef.current = st.launched ? 6000 : 700 + 5200 * Math.min(1, p);
    // lean away from the pull (drama), jitter when over-pulled
    if (tilt.current) {
      const lx = st.pull ? -st.pull.y / K * 1.6 : 0, ly = st.pull ? -st.pull.x / K * 1.6 : 0;
      tilt.current.rotation.set(lx + (st.over ? (Math.random() - .5) * .08 : 0), ly, 0);
    }
    if (cord.current) {
      const hx = st.pull ? st.pull.x / K * .9 - .012 : -.017, hy = st.pull ? -st.pull.y / K * .9 : 0;
      cord.current.geometry.setPositions([-.033, 0, .018, -.033 + hx, hy, .018 + (st.pull ? .012 : 0)]);
      cord.current.visible = !st.launched;
    }
  });
  return (
    <group ref={groupRef}>
      <group ref={tilt}>
        <BeyModel bey={bey} rpmRef={rpmRef} />
        {/* launcher clamped on top */}
        <group position={[0, 0, .016]}>
          <mesh material={body} rotation-x={Math.PI / 2}><cylinderGeometry args={[.0115, .0125, .005, 28]} /><Outlines thickness={3} color={INK} /></mesh>
          <mesh material={body} position={[-.02, 0, .002]}><boxGeometry args={[.026, .008, .006]} /><Outlines thickness={3} color={INK} /></mesh>
          <mesh material={grip} position={[-.033, 0, .002]} rotation-x={Math.PI / 2}><cylinderGeometry args={[.006, .006, .012, 16]} /><Outlines thickness={3} color={INK} /></mesh>
        </group>
      </group>
      <Line ref={cord} points={[[-.033, 0, .018], [-.05, 0, .018]]} color="#ffd400" lineWidth={5} />
    </group>
  );
}

function OppBey({ bey }) {
  const g = useRef(), rpmRef = useRef(3800);
  const z0 = useMemo(() => hoverZ(bey, ...OPP_SPOT), [bey]);
  useFrame(() => { if (g.current) g.current.position.set(OPP_SPOT[0], OPP_SPOT[1], z0 + Math.sin(performance.now() / 420) * .002); });
  return <group ref={g}><BeyModel bey={bey} rpmRef={rpmRef} /></group>;
}

/**
 * <LaunchStage3D myBey oppBey state={{pull,power,dir,over,aura,launched}} onPull(pull|null) onRelease(pull) disabled />
 * `state` is read every frame from a ref the parent keeps updated.
 */
export default function LaunchStage3D({ myBey, oppBey, stateRef, onPull, onRelease, disabled }) {
  const camRef = useRef(), wrap = useRef(), myGroup = useRef(), press = useRef(null);
  const ray = useMemo(() => new THREE.Raycaster(), []), plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -.25), []), hit = useMemo(() => new THREE.Vector3(), []);
  const toPhys = e => {
    const r = wrap.current.getBoundingClientRect(), cam = camRef.current; if (!cam) return null;
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return [hit.x / S, -hit.z / S]; // world -> physics (x, y)
  };
  const MAXP = 70 * 1.15;
  const pullFrom = e => {
    const p = toPhys(e); if (!p || !press.current) return null;
    let x = (p[0] - press.current[0]) * K, y = -(p[1] - press.current[1]) * K;
    const L = Math.hypot(x, y); if (L > MAXP) { x *= MAXP / L; y *= MAXP / L; }
    return { x, y };
  };
  const down = e => { if (disabled) return; const p = toPhys(e); if (!p) return; wrap.current.setPointerCapture?.(e.pointerId); press.current = p; onPull?.({ x: 0, y: 0 }); };
  const move = e => { if (!press.current || disabled) return; const pl = pullFrom(e); if (pl) onPull?.(pl); };
  const up = e => { if (!press.current) return; const pl = pullFrom(e) || { x: 0, y: 0 }; press.current = null; wrap.current.releasePointerCapture?.(e.pointerId); onRelease?.(pl); };

  return (
    <div ref={wrap} className="ls3d" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'none' }}>
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 42, near: .05, far: 60, position: [-3.4, 1.45, 0] }}>
        <ambientLight intensity={.85} />
        <directionalLight position={[-2, 5, 2]} intensity={1.7} />
        <directionalLight position={[3, 1.5, -2]} intensity={.6} color="#bcd4ff" />
        <group rotation-x={-Math.PI / 2} scale={S}>
          <Stadium />
          <MyBey bey={myBey} stateRef={stateRef} groupRef={myGroup} />
          <OppBey bey={oppBey} />
          <Aura stateRef={stateRef} groupRef={myGroup} />
          <AimArrow stateRef={stateRef} />
        </group>
        <CameraRig camRef={camRef} stateRef={stateRef} />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={.1} intensity={1.6} radius={.7} />
          <Vignette eskil={false} offset={.25} darkness={.55} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
