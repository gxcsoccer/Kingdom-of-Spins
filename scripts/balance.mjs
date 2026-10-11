// Balance sweep: player-style launches vs story bladers. node scripts/balance.mjs
import loadM from '@mujoco/mujoco';
import {Battle} from '../src/physics/simulation.js';
import {BEYS} from '../src/game/beys.js';
import {BLADERS} from '../src/game/story.js';
import {playerLaunch,cpuLaunch} from '../src/game/launch.js';
const M=await loadM();
const mine=process.argv[2]||'dragoon', style=process.argv[3]||'charge', n=+(process.argv[4]||3);
const rows=[];
for(const bl of BLADERS.filter(b=>b.tier==='normal'||b.tier==='pro')){
  for(let k=0;k<n;k++){
    const launches=[playerLaunch(style,.85,k+1),cpuLaunch(bl.launch,`${bl.name}-0-${k+1}`)];
    const b=new Battle(M,{beys:[BEYS[mine],bl.bey],launches});
    while(!b.ended)b.advance(800);
    rows.push(`${bl.name}#${k}: ${b.ended.winner?'LOSE':'WIN '} ${b.ended.reason.padEnd(6)} t=${b.ended.time.toFixed(1)}s hits=${b.events.filter(e=>e.type==='collision').length}`);
    b.dispose();
  }
}
console.log(rows.join('\n'));
