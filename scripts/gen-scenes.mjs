// Pre-generate the exploration scene library with Workers AI FLUX.2 klein 9B.
// usage: CF_TOKEN=... node scripts/gen-scenes.mjs [regionId] [--force]
import {SCENES} from '../src/game/scenes.js';
import {REGIONS} from '../src/game/regions.js';
import fs from 'node:fs/promises';
const ACC='6db2310bdcab56f5bdf834fb50ac05bc', TOK=process.env.CF_TOKEN, MODEL='@cf/black-forest-labs/flux-2-klein-9b';
const STYLE='Japanese shonen anime game background art, full colour cel shading, bold clean black ink outlines, screentone only in shadows, bright sunny day, saturated harmonious colours, kid-friendly adventurous mood, wide establishing shot, clear readable shapes. No people in the foreground, no text, no letters, no numbers, no logos, no watermark.';
const only=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:null, force=process.argv.includes('--force');
const jobs=[];
for(const [rid,list] of Object.entries(SCENES)){ if(only&&rid!==only)continue; const region=REGIONS.find(r=>r.id===rid);
  const THEME={harbor:'a sunny seaside harbour region',thunder:'a high mountain region with glaciers',volcano:'a volcanic island region'}[rid];
  for(const s of list) jobs.push({rid,s,prompt:`${STYLE} MAIN SUBJECT (fill the frame with it): ${s.desc}. Setting: ${THEME}. Show only this place, close enough to see details.`}); }
async function run({rid,s,prompt}){
  const out=`public/art/scenes/${rid}/${s.key}.raw.jpg`;
  if(!force) try{await fs.access(`public/art/scenes/${rid}/${s.key}.jpg`);return 'skip';}catch{}
  await fs.mkdir(`public/art/scenes/${rid}`,{recursive:true});
  for(let a=0;a<3;a++){
    const fd=new FormData();fd.append('prompt',prompt);fd.append('width','1024');fd.append('height','768');
    const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${MODEL}`,{method:'POST',headers:{Authorization:`Bearer ${TOK}`},body:fd});
    const d=await r.json().catch(()=>null); const img=d?.result?.image;
    if(img){await fs.writeFile(out,Buffer.from(img,'base64'));return 'ok';}
    console.error(rid,s.key,'retry',JSON.stringify(d?.errors||d).slice(0,160));
  }
  return 'fail';
}
let i=0;const res=[];
await Promise.all(Array.from({length:4},async()=>{while(i<jobs.length){const j=jobs[i++];const t=Date.now();const r=await run(j);res.push(r);console.log(r,j.rid,j.s.key,((Date.now()-t)/1000).toFixed(1)+'s');}}));
console.log('done',res.filter(r=>r==='ok').length,'ok',res.filter(r=>r==='fail').length,'fail');
