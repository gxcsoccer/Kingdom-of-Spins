// Re-locate each scene's tappable spots on the actual image via /api/ai/flip/locate (Claude vision) and print updates.
import fs from 'node:fs/promises';
import {SCENES} from '../src/game/scenes.js';
const API=process.env.API||'https://kingdom-of-spins.deskmind-site.workers.dev';
const jobs=Object.entries(SCENES).flatMap(([rid,l])=>l.map(s=>({rid,s})));
const out={};let i=0;
await Promise.all(Array.from({length:3},async()=>{while(i<jobs.length){const {rid,s}=jobs[i++];
  const b64=(await fs.readFile(`public/art/scenes/${rid}/${s.key}.jpg`)).toString('base64');
  const want=s.spots.map(p=>p.label).join('、');
  for(let a=0;a<3;a++){
    const r=await fetch(API+'/api/ai/flip/locate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({imageDataUrl:'data:image/jpeg;base64,'+b64,context:{title:s.title,text:`这是探索场景。请优先准确定位这些物体（用同样的中文名作 label）：${want}。图里没有的就换成图里最显眼、孩子会想点的其他物体。给 4 个。`}})}).then(r=>r.json()).catch(e=>({error:String(e)}));
    if(r.spots?.length>=3){out[`${rid}/${s.key}`]=r.spots.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2),label:p.label}));console.log(rid,s.key,r.spots.map(p=>p.label).join(','));break;}
    console.log('retry',rid,s.key,r.error);
  }}}));
await fs.writeFile(process.argv[2]||'art-gen/spots.json',JSON.stringify(out,null,1));
console.log('located',Object.keys(out).length,'/',jobs.length);
