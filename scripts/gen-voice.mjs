// 预生成固定台词的配音（Fish Audio s2.1-pro-free）。只发送我们自己写死的台词，不发送任何孩子的内容。
// 用法：node scripts/gen-voice.mjs   （读取 .env.local 里的 FISH_API_KEY；已存在的文件会跳过）
import fs from 'node:fs';
import crypto from 'node:crypto';
import {FLAVOR} from '../src/explore/flavor.js';
import {BLADERS} from '../src/game/story.js';
import {BEYS} from '../src/game/beys.js';
import {REGIONS} from '../src/game/regions.js';
import {SKILLS, skillOf} from '../src/game/team.js';
import {voKey} from '../src/game/voiceKey.js';

const KEY = (fs.readFileSync('.env.local', 'utf8').match(/^FISH_API_KEY=(.*)$/m) || [])[1]?.replace(/["'\s]/g, '');
if (!KEY) throw new Error('FISH_API_KEY missing in .env.local');
const VOICE = {doctor: 'ee18d36ee7bc4ab09f0533fa1e8e1ed0', boy: '2f0eb12d80d64f4b90fbfcf938b7f08d', girl: 'f8b0c42a585d4dc6b012caec1bc58252'};
const GIRLS = new Set(['hyomi', 'ran', 'nova']);

const lines = new Map();   // text -> voice
const add = (t, v = 'doctor') => { if (t && t.trim()) lines.set(t, v); };
for (const reg of Object.values(FLAVOR)) for (const sc of Object.values(reg)) {
  add(sc.narration);
  for (const sp of sc.spots || []) add(sp?.narration);
}
add('好眼力！看看下一个任务吧。');
add('看小地图右上角的指南针，上面是北！');
for (const r of REGIONS) for (const id of [...(r.beys || []), ...(r.bladers || [])]) {
  const name = BEYS[id] ? (BEYS[id].zh || BEYS[id].name) : BLADERS.find(b => b.id === id)?.name;
  if (name) add(`${name} 就在这张图里！点点画里的东西找找看。`);
}
for (const b of BLADERS.filter(b => b.tier === 'pro')) { const sk = SKILLS[skillOf(b)]; if (sk) add(`${b.name}，${sk.name}！`, GIRLS.has(b.id) ? 'girl' : 'boy'); }

fs.mkdirSync('public/audio/vo', {recursive: true});
const manifest = {};
const jobs = [...lines];
let i = 0, made = 0, failed = 0;
async function worker() {
  while (i < jobs.length) {
    const [text, voice] = jobs[i++];
    const key = voKey(text), file = `${crypto.createHash('sha1').update(voice + '|' + key).digest('hex').slice(0, 12)}.mp3`;
    manifest[key] = file;
    if (fs.existsSync(`public/audio/vo/${file}`)) continue;
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch('https://api.fish.audio/v1/tts', {method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', model: 's2.1-pro-free'},
          body: JSON.stringify({text, format: 'mp3', mp3_bitrate: 64, reference_id: VOICE[voice]})});
        if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
        fs.writeFileSync(`public/audio/vo/${file}`, Buffer.from(await r.arrayBuffer())); made++; break;
      } catch (e) { if (a === 2) { failed++; delete manifest[key]; console.error('FAIL', text.slice(0, 20), String(e).slice(0, 120)); } else await new Promise(r => setTimeout(r, 1500)); }
    }
  }
}
await Promise.all(Array.from({length: 6}, worker));
fs.writeFileSync('src/game/voiceClips.json', JSON.stringify(manifest));
console.log({lines: jobs.length, made, failed});
