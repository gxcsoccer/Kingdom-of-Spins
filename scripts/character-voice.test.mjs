import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BLADERS} from '../src/game/story.js';
import {SKILLS,skillOf} from '../src/game/team.js';
import {translate} from '../src/i18n/index.js';
import {clipFile} from '../src/game/voiceCatalog.js';
import {ttsPayload} from '../src/game/voiceProfiles.js';
import {tts} from '../worker/tts.js';

test('every opponent has English and Chinese clips; English clips never substitute for a different speaker',()=>{
  for(const b of BLADERS){
    const text=translate(b.line,[],'en'),file=clipFile(text,'en',b.id);
    assert.ok(file,b.id);
    assert.ok(fs.statSync(new URL('../public/audio/vo/'+file,import.meta.url)).size>1000,b.id);
    assert.ok(clipFile(b.line,'zh-CN',b.id),b.id+' Chinese');
    assert.equal(clipFile(text,'en','doctor'),undefined);
    assert.equal(clipFile(b.line,'en',b.id),undefined);
    if(b.tier==='pro'){
      const call=translate('{0}，{1}！',[translate(b.name,[],'en'),translate(SKILLS[skillOf(b)].name,[],'en')],'en');
      assert.ok(clipFile(call,'en',b.id),b.id+' team call');
    }
  }
});

test('English casting, delivery, and optional overrides remain separate from the doctor',()=>{
  const env={FISH_EN_VOICE_ID:'narrator',FISH_EN_RYUOH_VOICE_ID:'boss-override'};
  for(const b of BLADERS){
    const p=ttsPayload('Ready!',b.id,'en',env);
    assert.notEqual(p.reference_id,'narrator');
    assert.match(p.text,/^\[[^\]]+\] Ready!$/);
    assert.ok(p.prosody.speed>=.9&&p.prosody.speed<=1.1);
    assert.equal(p.mp3_bitrate,128);
  }
  assert.equal(ttsPayload('Ready!','ryuoh','en',env).reference_id,'boss-override');
  assert.equal(ttsPayload('Hello.','doctor','en',env).text,'Hello.');
  assert.equal(ttsPayload('Hello.','untrusted-id','en',env).reference_id,'narrator');
  assert.equal(ttsPayload('Hello.','doctor','en',{}),null);
  assert.equal(ttsPayload('来吧！','ryuoh','zh-CN',env).text,'来吧！');
});

test('worker passes character casting and separates audio cache by speaker and delivery',async()=>{
  const oldFetch=globalThis.fetch,oldCaches=globalThis.caches;
  const payloads=[],keys=[];
  globalThis.fetch=async(_url,opts)=>{payloads.push(JSON.parse(opts.body));return new Response(new Uint8Array([1,2]));};
  globalThis.caches={default:{match:async req=>{keys.push(req.url);},put:async()=>{}}};
  try{
    for(const voice of ['doctor','ryuoh','tetsu','raiga']){
      const req=new Request('http://local/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Ready!',locale:'en',voice})});
      assert.equal((await tts(req,{FISH_API_KEY:'fixture',FISH_EN_VOICE_ID:'narrator'},{waitUntil:()=>{}})).status,200);
    }
    assert.equal(new Set(keys).size,4);
    assert.notEqual(payloads[0].reference_id,payloads[1].reference_id);
    assert.notEqual(payloads[2].text,payloads[3].text);
  }finally{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;}
});
