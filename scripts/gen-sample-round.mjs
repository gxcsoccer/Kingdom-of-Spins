// Dev-only: produce one real battle round (samples/events/summary) for the result-screen harness.
import loadM from '@mujoco/mujoco';
import {writeFileSync} from 'node:fs';
import {Battle} from '../src/physics/simulation.js';
import {BEYS} from '../src/game/beys.js';
const M=await loadM();
for (let k=0;k<12;k++){
  const launches=[{rpm:5600,tilt:4,angle:Math.PI+k*.37,speed:.42,aim:.55},{rpm:4900,tilt:4,angle:k*.37,speed:.35,aim:.5}];
  const b=new Battle(M,{beys:[BEYS.dragoon,BEYS.titan],launches});
  while(!b.ended)b.advance(400);
  const hits=b.events.filter(e=>e.type==='collision').length;
  if(hits>=2&&b.ended.time>3){ writeFileSync(process.argv[2],JSON.stringify({launches,result:b.ended,summary:b.summary(),samples:b.samples,events:b.events})); console.log('ok',k,b.ended,hits); break; }
  b.dispose();
}
