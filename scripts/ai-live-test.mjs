// Hit every AI route on a running worker (wrangler dev / deployed) and print timing + provider.
// node scripts/ai-live-test.mjs [baseUrl] [route...]   (routes: fusion vague commentary moments experiment ask sketch)
import {readFileSync} from 'node:fs';
import {BEYS} from '../src/game/beys.js';
const base = process.argv[2] || 'http://127.0.0.1:8787';
const only = process.argv.slice(3);
const SUM = {parts:[{wings:3,style:'attack',reach:.029,ring:70,massG:42.7,tip:'flat',height:60,inertiaZ:2.1e-5},{wings:4,style:'stamina',reach:.025,ring:80,massG:38.7,tip:'needle',height:55,inertiaZ:1.5e-5}],
  result:{winner:1,reason:'spin',points:1,time:9.82}, stats:[{hits:4,maxSpeed:1.6},{hits:4,maxSpeed:.5}],
  events:[{time:.4632,type:'collision',relSpeed:1.2341,intensity:.6,rpm:[6210,6655]},{time:2.1187,type:'collision',relSpeed:1.9012,intensity:1,rpm:[4650,5980]},{time:3.5,type:'dash',body:0},{time:9.82,type:'finish',winner:1,reason:'spin',points:1}]};
const MOMENTS = [
  {id:'m1',time:.4632,kind:'first-hit',data:{relSpeed:1.2341,intensity:.6,rpmBefore:[6800,6900],rpmAfter:[6210,6655]}},
  {id:'m2',time:2.1187,kind:'big-hit',data:{relSpeed:1.9012,intensity:1,rpmBefore:[5900,6400],rpmAfter:[4650,5980]}},
  {id:'m3',time:3.5,kind:'dash',body:0,data:{}},
  {id:'m4',time:7.204,kind:'spin-drop',body:0,data:{drop:2100}},
  {id:'m5',time:9.82,kind:'finish',data:{reason:'spin',winner:1}}];
const EXP = {names:['Dragoon','Mist Fish'], variable:{key:'bit',label:'轴尖',from:'平轴',to:'圆轴'}, prediction:'more', metric:{label:'坚持时间',unit:'秒'},
  stats:{A:{wins:0,trials:3,avgTime:6.4,avgRpm3:4100,avgHits:5.3},B:{wins:2,trials:3,avgTime:14.2,avgRpm3:5600,avgHits:3.7}},
  trials:[{A:{winner:1,reason:'spin',time:6.1,rpm3:4000},B:{winner:0,reason:'spin',time:15.2,rpm3:5700}},{A:{winner:1,reason:'over',time:3.9,rpm3:3900},B:{winner:0,reason:'judge',time:30,rpm3:5600}},{A:{winner:1,reason:'spin',time:9.2,rpm3:4400},B:{winner:1,reason:'over',time:4.5,rpm3:5500}}]};
const img = process.env.SKETCH_IMG;
const cases = {
  fusion: ['/api/ai/fusion/chat', {parents:[BEYS.fish, BEYS.dragoon], wish:'我想要一个转得很久、但是被撞也不怕的陀螺', keepParent:0}],
  vague: ['/api/ai/fusion/chat', {parents:[BEYS.goatpuff, BEYS.ninjamight], wish:'帮我融合一个超酷的', keepParent:1}],
  commentary: ['/api/ai/commentary', {summary:SUM, names:['Dragoon','Mist Fish']}],
  moments: ['/api/ai/moments', {summary:SUM, moments:MOMENTS, names:['Dragoon','Mist Fish']}],
  experiment: ['/api/ai/experiment', EXP],
  ask: ['/api/ai/ask', {question:'为什么尖尖的轴转得更久？'}],
  sketch: ['/api/ai/sketch', {imageDataUrl: img ? 'data:image/png;base64,'+readFileSync(img).toString('base64') : '', wish:'四片翅膀的火焰陀螺'}],
};
for (const [k,[path,body]] of Object.entries(cases)) {
  if (only.length && !only.includes(k)) continue;
  const t = performance.now();
  const r = await fetch(base+path, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
  const out = await r.json();
  console.log(`\n=== ${k} ${r.status} ${((performance.now()-t)/1000).toFixed(1)}s via=${out.via||(out.fallback?'template':'?')}${out.error?' error='+out.error.slice(0,160):''}`);
  console.log(JSON.stringify(out, null, 1).slice(0, 1800));
}
