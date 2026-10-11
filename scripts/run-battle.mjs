// Headless battle runner for tuning: node scripts/run-battle.mjs dragoon fish
import loadM from '@mujoco/mujoco';
import {Battle} from '../src/physics/simulation.js';
import {BEYS} from '../src/game/beys.js';
const M=await loadM();
const [a='dragoon',b='fish',n='4']=process.argv.slice(2);
for(let k=0;k<+n;k++){
  const t=performance.now();
  const launches=[{rpm:5000,tilt:5,angle:Math.PI+k*.4,speed:.4,aim:.6},{rpm:5000,tilt:5,angle:k*.4,speed:.4,aim:.6}];
  const battle=new Battle(M,{beys:[BEYS[a],BEYS[b]],launches});
  while(!battle.ended)battle.advance(400);
  const ms=performance.now()-t, ev=battle.events;
  const s=battle.samples.at(-1);
  console.log(`#${k} ${a} vs ${b}: winner=${battle.ended.winner?b:a} ${battle.ended.reason} t=${battle.ended.time}s wall=${(ms/1000).toFixed(1)}s rt=${(battle.time/(ms/1000)).toFixed(1)}x hits=${ev.filter(e=>e.type==='collision').length} dash=${ev.filter(e=>e.type==='dash').length} rpm=${s.bodies.map(b=>Math.round(b.rpm))} maxI=${Math.max(0,...ev.filter(e=>e.type==='collision').map(e=>e.intensity))}`);
  battle.dispose();
}
