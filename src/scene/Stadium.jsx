import { useMemo } from 'react';
import * as THREE from 'three';
import { Outlines } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { ARENA } from '../physics/model.js';
import { halftoneMaterial } from './halftone.js';
import { INK, toonMat, canvasTexture, blobShadowTexture } from './toon.js';

// Xtreme-style stadium in physics coordinates (meters, Z up), matching ARENA / floorHeight / pocketAt.
const Z_UP = new THREE.Matrix4().makeRotationX(Math.PI / 2);
const SEG = (2 * Math.PI) / ARENA.segments;
const WALL_IN = ARENA.wall - .002, WALL_OUT = ARENA.wall + .006, SHELL_OUT = .236;

// contiguous [a0, a1] angle runs of wall vs. pocket
function runs() {
  const kinds = [];
  for (let i = 0; i < ARENA.segments; i++) {
    const p = ARENA.pockets.find(q => i >= q.from && i <= q.to);
    kinds.push(p ? p.kind : 'wall');
  }
  const out = [];
  let start = 0;
  for (let i = 1; i <= ARENA.segments; i++) {
    if (i === ARENA.segments || kinds[i] !== kinds[start]) { out.push({ kind: kinds[start], a0: start * SEG, a1: i * SEG }); start = i; }
  }
  // merge wrap-around wall runs
  if (out.length > 1 && out[0].kind === out.at(-1).kind) { const last = out.pop(); out[0] = { ...out[0], a0: last.a0 - 2 * Math.PI }; }
  return out;
}

function sector(rIn, rOut, a0, a1, z0, z1, curve = 24) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: curve });
  g.translate(0, 0, z0);
  return g;
}

function laneTexture() {
  // gear-tooth band for the Xtreme line
  return canvasTexture('xline', 512, 64, (g, w, h) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd400';
    for (let i = 0; i < 16; i++) { const x = i * w / 16; g.beginPath(); g.moveTo(x + 4, h - 8); g.lineTo(x + 14, 10); g.lineTo(x + 26, 10); g.lineTo(x + 18, h - 8); g.fill(); }
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
  }, { repeat: [6, 1] });
}

function centerTexture() {
  return canvasTexture('center', 1024, 1024, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, w, h);
    // concentration lines (集中線)
    g.fillStyle = 'rgba(17,17,17,.9)';
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2 + Math.sin(i * 12.9898) * .02, wdt = .006 + (Math.abs(Math.sin(i * 78.233)) * .012);
      const r0 = 180 + Math.abs(Math.sin(i * 3.7)) * 150, r1 = 520;
      g.beginPath();
      g.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
      g.lineTo(cx + r1 * Math.cos(a - wdt), cy + r1 * Math.sin(a - wdt));
      g.lineTo(cx + r1 * Math.cos(a + wdt), cy + r1 * Math.sin(a + wdt));
      g.fill();
    }
    g.strokeStyle = INK; g.lineWidth = 10;
    g.beginPath(); g.arc(cx, cy, 170, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 150, 0, Math.PI * 2); g.stroke();
    // big X
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
    g.fillStyle = '#ff2d4a'; g.strokeStyle = INK; g.lineWidth = 10;
    for (const r of [0, Math.PI / 2]) { g.save(); g.rotate(r); g.beginPath(); g.rect(-120, -24, 240, 48); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = '#ff2d4a'; g.fillRect(-114, -20, 228, 40); g.fillRect(-20, -114, 40, 228);
    g.restore();
  });
}

function pocketTexture(kind) {
  return canvasTexture('pocket:' + kind, 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2);
    if (kind === 'xtreme') {
      g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 12;
      for (const r of [0, Math.PI / 2]) { g.save(); g.rotate(r); g.beginPath(); g.rect(-100, -24, 200, 48); g.fill(); g.stroke(); g.restore(); }
      g.fillStyle = '#fff'; g.fillRect(-94, -18, 188, 36); g.fillRect(-18, -94, 36, 188);
    } else {
      g.fillStyle = INK;
      for (const y of [-50, 10]) { g.beginPath(); g.moveTo(-80, y + 40); g.lineTo(0, y - 10); g.lineTo(80, y + 40); g.lineTo(80, y + 70); g.lineTo(0, y + 20); g.lineTo(-80, y + 70); g.fill(); }
    }
    g.restore();
  });
}

export default function Stadium() {
  const dpr = useThree(st => st.viewport.dpr);
  const parts = useMemo(() => {
    const { flat, slopeEnd, rise } = ARENA;
    // bowl surface (lathe: x=r, y=z)
    const prof = [new THREE.Vector2(WALL_IN, rise), new THREE.Vector2(slopeEnd, rise), new THREE.Vector2(flat, 0)];
    const slope = new THREE.LatheGeometry(prof, 96).applyMatrix4(Z_UP);
    const centre = new THREE.CircleGeometry(flat, 96);
    // Xtreme line band on the slope, r .148 – .172
    const zAt = r => Math.max(0, r - flat) * rise / (slopeEnd - flat);
    const lane = new THREE.LatheGeometry([new THREE.Vector2(.172, zAt(.172) + .0005), new THREE.Vector2(.148, zAt(.148) + .0005)], 128).applyMatrix4(Z_UP);
    const inkRing = (r, w) => { const g = new THREE.RingGeometry(r - w, r + w, 128); return g; };
    const walls = [], shells = [], pockets = [];
    for (const run of runs()) {
      if (run.kind === 'wall') {
        walls.push(sector(WALL_IN, WALL_OUT, run.a0, run.a1, rise - .004, .06));
        shells.push(sector(WALL_OUT, SHELL_OUT, run.a0, run.a1, -.016, .052));
      } else {
        pockets.push({ kind: run.kind, mid: (run.a0 + run.a1) / 2,
          floor: sector(ARENA.slopeEnd, SHELL_OUT - .006, run.a0, run.a1, -.004, 0, 8),
          back: sector(SHELL_OUT - .006, SHELL_OUT, run.a0 - SEG * .35, run.a1 + SEG * .35, -.016, .03, 8),
          lipL: sector(WALL_OUT, SHELL_OUT, run.a0 - SEG * .35, run.a0, -.016, .052, 4),
          lipR: sector(WALL_OUT, SHELL_OUT, run.a1, run.a1 + SEG * .35, -.016, .052, 4) });
      }
    }
    const base = new THREE.CylinderGeometry(SHELL_OUT + .004, SHELL_OUT + .012, .02, 96).applyMatrix4(Z_UP);
    base.translate(0, 0, -.026);
    return { slope, centre, lane, walls, shells, pockets, base, ring1: inkRing(flat, .0007), ring2: inkRing(slopeEnd, .0008) };
  }, []);

  const mats = useMemo(() => ({
    slope: halftoneMaterial({ color: '#f3efe4', shade: '#dcd5c4', cell: 5.5, ao: .42, aoRange: [.12, .19] }),
    centre: halftoneMaterial({ color: '#fbf8f1', shade: '#e6e0d1', cell: 5.5, ao: 0, map: centerTexture() }),
    lane: new THREE.MeshBasicMaterial({ map: (() => { const t = laneTexture(); return t; })(), polygonOffset: true, polygonOffsetFactor: -2 }),
    wall: halftoneMaterial({ color: '#ffffff', shade: '#cfd6e0', cell: 5, ao: 0 }),
    shell: halftoneMaterial({ color: '#2b2f3a', shade: '#1b1e25', ink: '#000000', cell: 5, ao: 0 }),
    base: toonMat('#16181d'),
    ink: new THREE.MeshBasicMaterial({ color: INK, polygonOffset: true, polygonOffsetFactor: -3 }),
    pocket: {
      xtreme: halftoneMaterial({ color: '#ff2d4a', shade: '#b8142c', cell: 5, ao: 0 }),
      over: halftoneMaterial({ color: '#ffd400', shade: '#d9a800', cell: 5, ao: 0 }),
    },
    pocketDecal: {
      xtreme: new THREE.MeshBasicMaterial({ map: pocketTexture('xtreme'), transparent: true, depthWrite: false }),
      over: new THREE.MeshBasicMaterial({ map: pocketTexture('over'), transparent: true, depthWrite: false }),
    },
    shadow: new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity: .55, depthWrite: false }),
  }), []);

  const O = <Outlines thickness={2.4 * dpr} color={INK} />;
  return (
    <group>
      <mesh geometry={parts.centre} material={mats.centre} />
      <mesh geometry={parts.slope} material={mats.slope} />
      <mesh geometry={parts.lane} material={mats.lane} />
      <mesh geometry={parts.ring1} material={mats.ink} position={[0, 0, .0003]} />
      {parts.walls.map((g, i) => <mesh key={'w' + i} geometry={g} material={mats.wall}>{O}</mesh>)}
      {parts.shells.map((g, i) => <mesh key={'s' + i} geometry={g} material={mats.shell}>{O}</mesh>)}
      {parts.pockets.map((p, i) => (
        <group key={'p' + i}>
          <mesh geometry={p.floor} material={mats.pocket[p.kind]}>{O}</mesh>
          <mesh geometry={p.back} material={mats.shell}>{O}</mesh>
          <mesh geometry={p.lipL} material={mats.shell}>{O}</mesh>
          <mesh geometry={p.lipR} material={mats.shell}>{O}</mesh>
          <mesh material={mats.pocketDecal[p.kind]} position={[.209 * Math.cos(p.mid), .209 * Math.sin(p.mid), .0006]} rotation={[0, 0, p.mid - Math.PI / 2]}>
            <planeGeometry args={[.034, .034]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={parts.base} material={mats.base}>{O}</mesh>
      <mesh material={mats.shadow} position={[.02, -.03, -.036]} scale={[1.2, 1.2, 1]}>
        <planeGeometry args={[.6, .6]} />
      </mesh>
    </group>
  );
}
