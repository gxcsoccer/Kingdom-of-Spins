// Generate art with openai/gpt-image-2 through a local wrangler dev proxy (AI binding + gateway unified billing).
// usage: node scripts/gen-art.mjs jobs.json [concurrency]   jobs: [{out, prompt, size?, background?}]
import fs from 'node:fs/promises'; import path from 'node:path';
const jobs=JSON.parse(await fs.readFile(process.argv[2],'utf8')), N=+(process.argv[3]||3), PROXY=process.env.PROXY||'http://127.0.0.1:8797';
let i=0;const res=[];
await Promise.all(Array.from({length:N},async()=>{while(i<jobs.length){const j=jobs[i++];
  if(!process.env.FORCE)try{await fs.access(j.out);console.log('skip',j.out);continue;}catch{}
  let buf,ms,fail;
  try{const r=await fetch(PROXY,{method:'POST',body:JSON.stringify(j)});
    if((r.headers.get('content-type')||'').startsWith('image/')){buf=Buffer.from(await r.arrayBuffer());ms=+r.headers.get('x-ms');}
    else fail=await r.text();}catch(e){fail=String(e);}
  if(!buf){console.log('FAIL',j.out,String(fail).slice(0,200));res.push(0);continue;}
  const r={ms};
  await fs.mkdir(path.dirname(j.out),{recursive:true});await fs.writeFile(j.out,buf);
  console.log('ok',j.out,(r.ms/1000).toFixed(1)+'s',(buf.length/1024|0)+'KB');res.push(1);}}));
console.log('done',res.filter(Boolean).length,'/',jobs.length);
