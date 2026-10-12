// Only fixed, authored English character lines. Never sends profile data.
// Run: node scripts/gen-voice-en.mjs [character-id]
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BLADERS} from '../src/game/story.js';
import {SKILLS,skillOf} from '../src/game/team.js';
import {translate} from '../src/i18n/index.js';
import {ttsPayload} from '../src/game/voiceProfiles.js';
import {voKey} from '../src/game/voiceKey.js';
const vars=Object.fromEntries(['.env.local','.dev.vars'].filter(f=>fs.existsSync(f)).flatMap(f=>fs.readFileSync(f,'utf8').split('\n').map(l=>l.match(/^([A-Z_]+)\s*=\s*["']?([^"'\r]+)["']?$/)).filter(Boolean).map(m=>[m[1],m[2].trim()])));
const key=process.env.FISH_API_KEY||vars.FISH_API_KEY;
if(!key)throw Error('FISH_API_KEY missing');
const manifestFile='src/game/voiceClips.en.json';
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const only=process.argv[2];
if(only&&!BLADERS.some(b=>b.id===only))throw Error('Unknown character ID');
fs.mkdirSync('public/audio/vo/en',{recursive:true});
for(const b of BLADERS.filter(b=>!only||b.id===only)){
  const lines=[translate(b.line,[],'en')];
  if(b.tier==='pro')lines.push(translate('{0}，{1}！',[translate(b.name,[],'en'),translate(SKILLS[skillOf(b)].name,[],'en')],'en'));
  const entries={};
  for(const text of lines){
    const payload=ttsPayload(text,b.id,'en',vars);
    const hash=crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0,12);
    const file=`en/${b.id}-${hash}.mp3`, path=`public/audio/vo/${file}`;
    if(!fs.existsSync(path)){
      const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60_000)});
      if(!r.ok)throw Error(`${b.id}: Fish returned ${r.status}`);
      const bytes=Buffer.from(await r.arrayBuffer());
      if(bytes.length<1000)throw Error(`${b.id}: empty audio`);
      fs.writeFileSync(path,bytes);
    }
    entries[voKey(text)]=file;
    console.log(`${b.id}: ${text} -> ${file}`);
  }
  manifest[b.id]=entries;
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
}
