import loadM from '@mujoco/mujoco';
import {Battle} from '../src/physics/simulation.js';
import {BEYS} from '../src/game/beys.js';
const M=await loadM();
const [a,b,speed,tilt]=process.argv.slice(2);
const battle=new Battle(M,{beys:[BEYS[a],BEYS[b]],launches:[{rpm:5000,tilt:+tilt,angle:Math.PI,speed:+speed,aim:.6},{rpm:5000,tilt:+tilt,angle:0,speed:+speed,aim:.6}],maxTime:6});
for(let i=0;i<30&&!battle.ended;i++){battle.advance(200);const s=battle.samples.at(-1);console.log(s.time.toFixed(2),s.bodies.map(b=>`rpm=${Math.round(b.rpm)} tilt=${b.tilt.toFixed(1)} z=${(b.p[2]*1000).toFixed(1)} r=${(Math.hypot(b.p[0],b.p[1])*1000).toFixed(0)}`).join(' | '));}
console.log(battle.ended, battle.events.filter(e=>e.type!=='dash'));
