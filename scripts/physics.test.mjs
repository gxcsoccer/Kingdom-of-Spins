import test from 'node:test';
import assert from 'node:assert/strict';
import loadM from '@mujoco/mujoco';
import {Battle} from '../src/physics/simulation.js';
import {BEYS} from '../src/game/beys.js';
import {specFromBey,makePart} from '../src/physics/model.js';
import {playerLaunch,cpuLaunch} from '../src/game/launch.js';
const M=await loadM();
const run=(a,b,launches)=>{const x=new Battle(M,{beys:[a,b],launches});while(!x.ended)x.advance(800);const r={...x.ended,events:x.events.length,last:x.samples.at(-1)};x.dispose();return r;};

test('identical inputs give identical battles (PvP relies on this)',()=>{
  const launches=[playerLaunch('charge',.8,1),cpuLaunch({rpm:5000,tilt:4,speed:.3,aim:.5},'seed-1')];
  const r1=run(BEYS.dragoon,BEYS.goatpuff,launches), r2=run(BEYS.dragoon,BEYS.goatpuff,structuredClone(launches));
  assert.deepEqual(r1,r2);
});
test('every battle ends with a finish and finite state',()=>{
  const r=run(BEYS.fish,BEYS.titan,[playerLaunch('orbit',.9,2),cpuLaunch({rpm:5000},'s2')]);
  assert.ok(['xtreme','over','spin','judge'].includes(r.reason));
  assert.ok(r.last.bodies.every(b=>[...b.p,...b.q,b.rpm].every(Number.isFinite)));
});
test('invalid AI-generated blade params are clamped to the safe range',()=>{
  const s=specFromBey({blade:{wings:9,reach:1,ring:500,mass:-3,style:'laser'},ratchet:{height:99},bit:'rocket'});
  assert.deepEqual([s.wings,s.reach,s.ring,s.bladeMass,s.style,s.height,s.tip],[3,.03,85,24,'balance',60,'ball']);
  const p=makePart(s);assert.ok(p.inertia.every(v=>v>0)&&p.inertia[2]>p.inertia[0]);
});
test('more mass on the outer ring raises spin-axis inertia',()=>{
  const lo=makePart(specFromBey({blade:{ring:30}})),hi=makePart(specFromBey({blade:{ring:80}}));
  assert.ok(hi.inertia[2]>lo.inertia[2]);
});
