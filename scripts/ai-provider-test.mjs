// Checks the provider chain: a bogus gateway key must fail fast and fall back to Workers AI.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {llm} from '../worker/ai.js';
const ACC='6db2310bdcab56f5bdf834fb50ac05bc', TOK=/oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8'))[1];
const AI={async run(model,input){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`,{method:'POST',headers:{authorization:`Bearer ${TOK}`,'content-type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!d.success)throw new Error(JSON.stringify(d.errors));return d.result;}};
const key = process.env.AI_GATEWAY_API_KEY || 'bogus-key';
const t=performance.now();
const out = await llm({AI, AI_GATEWAY_API_KEY:key}, {system:'只输出 JSON。', user:'用一句话告诉10岁小朋友为什么陀螺转得快不会倒。输出 {"answer":""}', maxTokens:200, kind:'ask'});
console.log(((performance.now()-t)/1000).toFixed(1)+'s', out.__via, out);
try { await llm({AI_GATEWAY_API_KEY:key}, {system:'x', user:'{"a":1}', maxTokens:50, kind:'ask', claudeOnly:true}); } catch(e) { console.log('claudeOnly error ->', e.message.slice(0,200)); }
