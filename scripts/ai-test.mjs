// Exercise worker/ai.js against real Workers AI via the REST API (adapter mimics env.AI.run).
// node scripts/ai-test.mjs [fusion|vague|commentary|ask|fallback]
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {handle} from '../worker/ai.js';
import {BEYS} from '../src/game/beys.js';

const ACC = process.env.CF_ACCOUNT_ID || '6db2310bdcab56f5bdf834fb50ac05bc';
const TOK = process.env.CF_API_TOKEN || /oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8'))[1];
const env = {AI:{async run(model, input) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`, {method:'POST', headers:{authorization:`Bearer ${TOK}`, 'content-type':'application/json'}, body:JSON.stringify(input)});
  const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d.result;
}}};
const call = async (path, body, e=env) => { const t=performance.now(); const r = await handle(new Request('http://x'+path, {method:'POST', body:JSON.stringify(body)}), e); const out = await r.json(); console.log(`== ${path} ${((performance.now()-t)/1000).toFixed(1)}s`); console.log(JSON.stringify(out, null, 1)); return out; };

const which = process.argv[2] || 'fusion';
if (which==='fusion') await call('/api/ai/fusion/chat', {parents:[BEYS.fish, BEYS.dragoon], wish:'我想要一个转得很久、但是被撞也不怕的陀螺', keepParent:0});
if (which==='vague') await call('/api/ai/fusion/chat', {parents:[BEYS.goatpuff, BEYS.ninjamight], wish:'帮我融合一个超酷的', keepParent:1});
if (which==='followup') await call('/api/ai/fusion/chat', {parents:[BEYS.goatpuff, BEYS.ninjamight], wish:'冲上去把对手撞飞 💥', keepParent:1, history:[{role:'user',content:'帮我融合一个超酷的'},{role:'assistant',content:'你最想要什么？',question:'你最想要新陀螺在哪方面超厉害？'}]});
if (which==='commentary') await call('/api/ai/commentary', {names:['Dragoon','GoatPuff'], summary:{model:'MuJoCo', parts:[{wings:3,style:'attack',reach:.029,ring:70,massG:42.7,tip:'flat',height:60,inertiaZ:2.1e-5},{wings:2,style:'defense',reach:.027,ring:55,massG:45.7,tip:'ball',height:60,inertiaZ:1.9e-5}], result:{winner:1,reason:'spin',points:1,time:4.91}, stats:[{hits:2,maxSpeed:1.6},{hits:2,maxSpeed:.5}], events:[{time:.55,type:'collision',relSpeed:1.96,intensity:1,rpm:[3929,4932]},{time:2.1,type:'collision',relSpeed:.8,intensity:.6,rpm:[2100,3300]},{time:4.91,type:'finish',winner:1,reason:'spin',points:1}]}});
if (which==='ask') await call('/api/ai/ask', {question:'为什么尖尖的轴转得更久？'});
if (which==='fallback') { await call('/api/ai/fusion/chat', {parents:[BEYS.titan, BEYS.fish], wish:'要很重很稳'}, {}); await call('/api/ai/fusion/chat', {parents:[BEYS.goatpuff, BEYS.ninjamight], wish:'嗯'}, {}); await call('/api/ai/commentary', {names:['Fish','Titan'], summary:{parts:[{ring:80},{ring:68}],result:{winner:0,reason:'judge',points:1,time:30}, events:[{time:1.2,type:'collision',relSpeed:.4,intensity:.3,rpm:[4800,4700]}]}}, {}); }
