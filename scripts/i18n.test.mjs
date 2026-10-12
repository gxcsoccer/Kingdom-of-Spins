import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from '@babel/parser';
import {detectLocale, normalizeLocale, translate, localizeTextFields, limitText, speechVoice} from '../src/i18n/index.js';
import {createFallback} from '../src/ai/fallback.js';
import {CARDS} from '../src/knowledge/cards.js';
import {BEYS} from '../src/game/beys.js';
import {handle, llm, clip} from '../worker/ai.js';
import {tts} from '../worker/tts.js';
import {isScienceQuestion} from '../src/fusion/intent.js';
const en=JSON.parse(fs.readFileSync(new URL('../src/i18n/en.json',import.meta.url)));
const hasHan = value => /[\u3400-\u9fff]/.test(JSON.stringify(value, (key,v)=>key==='verdict'?undefined:v));

test('English questions without punctuation use science Q&A while design requests stay in fusion',()=>{
  for (const text of ['Why does outer rim weight help stamina', '  HOW does friction work  ', 'What is rotational inertia', 'Does a needle bit help?', '为什么外圈重转得久']) assert.equal(isScienceQuestion(text),true,text);
  for (const text of ['Make it blue with lightning patterns', 'I want longer stamina', 'Can you make the blades sharper', '换成红色']) assert.equal(isScienceQuestion(text),false,text);
});

test('only Chinese and English are selected; saved language wins and restricted storage is safe',()=>{
  assert.equal(normalizeLocale('en-GB'),'en');assert.equal(normalizeLocale('ja-JP'),'zh-CN');
  assert.equal(detectLocale({getItem:()=> 'zh-CN'},['en-US']),'zh-CN');
  assert.equal(detectLocale({getItem:()=> 'ja'},['en-US']),'en');
  assert.equal(detectLocale({getItem:()=>{throw Error('denied');}},['en-US']),'en');
});
test('catalog keeps every placeholder and every UI translation has an English entry',()=>{
  const slots=s=>[...new Set(s.match(/\{\d+\}/g)||[])].sort();
  for(const[key,value]of Object.entries(en))assert.deepEqual(slots(value),slots(key),key);
  for(const file of fs.readdirSync(new URL('../src/',import.meta.url),{recursive:true}).filter(f=>/\.(js|jsx)$/.test(f)&&!f.includes('sandbox')&&!f.startsWith('i18n/'))){
    const ast=parse(fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{sourceType:'module',plugins:['jsx']});
    const walk=n=>{if(!n||typeof n!=='object')return;
      if(n.type==='CallExpression'&&n.callee.name==='tr'&&n.arguments[0]?.type==='StringLiteral')assert.ok(Object.hasOwn(en,n.arguments[0].value),file+': '+n.arguments[0].value);
      for(const[k,v]of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v);}
    };walk(ast);
  }
});
test('translations preserve IDs, player nicknames, unknown custom text and physics verdicts',()=>{
  const input={id:'测试',nickname:'小龙',verdict:'B更好',title:'继续前进',custom:'我的独特名字'};
  assert.deepEqual(localizeTextFields(input,'en'),{...input,title:'Keep going'});
  assert.equal(translate('{0} 秒',[0],'en'),'0 s');
});
test('English wishes select physics, appearance and a player-provided name',()=>{
  const f=createFallback('en');
  const wish='A black and red metal dragon with claws and lightning, strong attack. Name it Rocket';
  assert.equal(f.wishStyles(wish)[0],'attack');assert.equal(f.kidName(wish),'Rocket');
  const out=f.templateFusion({parents:[BEYS.dragoon,BEYS.fish],wish});
  assert.equal(out.candidates[0].look.shape,'claw');assert.equal(out.candidates[0].look.pattern,'bolts');
  assert.equal(out.candidates[0].colors.primary,'#16161a');assert.equal(out.candidates[0].colors.secondary,'#e8202a');
  assert.equal(hasHan(out),false);assert.match(out.candidates[0].specialMove.name,/Dragon/);
});
test('English offline knowledge, moments, experiments and book pages stay English',()=>{
  const f=createFallback('en');
  assert.equal(hasHan(f.templateAsk('inertia')),false);
  for(const kind of ['first-hit','big-hit','spin-drop','dash','finish']) {
    const moment={id:kind,kind,time:10.5,body:0,data:{winner:0,reason:'spin',relSpeed:1.2,drop:1000,rpmBefore:[5000,4500],rpmAfter:[4000,3000]}};
    const out=f.templateMoment(moment,['Dragoon','Fish']);assert.equal(hasHan(out),false,kind);assert.match(out.explain,/10\.5 s/);
  }
  for(const key of ['bit','ring','height','wings','rpm']){
    const out=f.templateExperiment({variable:{key,from:key==='bit'?'flat':30,to:key==='bit'?'needle':80},prediction:'more',stats:{A:{wins:1,trials:3,avgRpm3:1000},B:{wins:2,trials:3,avgRpm3:2000}}});
    assert.equal(out.verdict,'B更好');assert.equal(hasHan(out),false,key);
  }
  for(const card of CARDS)assert.equal(hasHan(f.templateFlipPage({cardId:card.id})),false,card.id);
});
test('word limits preserve English spaces and do not use Chinese character budgets',()=>{
  const s='Rotational inertia helps this top keep spinning for longer.';
  assert.equal(limitText(s,14),s);assert.equal(clip(s,14),s);
  const f=createFallback('en'),page=f.sanitizePage({title:'Rotational inertia',panels:[{text:s}],hotspots:[{label:'Outer rim'}]});
  assert.equal(page.title,'Rotational inertia');assert.equal(page.panels[0].text,s);assert.equal(page.hotspots[0].label,'Outer rim');
  assert.equal(f.contradictsVerdict('The modified top is better.','A更好'),true);
});
test('English science prose retains readable references and spacing after times',()=>{
  const f=createFallback('en');
  assert.equal(f.sanitizeCandidate({why:'It is hard to stop. See (ph-inertia)!'}).why,'It is hard to stop. See Rotational inertia!');
  const drop=f.templateMoment({kind:'spin-drop',time:1.3,body:0,data:{drop:1600,window:0.5,cause:'friction'}},['Sky Comet','Fish']);
  assert.match(drop.explain,/At 1\.3 s, your Sky Comet lost about 1,600 rpm within 0\.5 s/);
  const hit=f.templateMoment({kind:'big-hit',time:6.7,data:{relSpeed:0.6}});
  assert.match(hit.explain,/At 6\.7 s: A heavy hit/);
});
test('concurrent worker requests keep English and Chinese independent',async()=>{
  const ask=locale=>handle(new Request('http://local/api/ai/ask',{method:'POST',body:JSON.stringify({locale,question:'inertia'})}),{}).then(r=>r.json());
  const out=await Promise.all(Array.from({length:8},(_,i)=>ask(i%2?'zh-CN':'en')));
  out.forEach((r,i)=>assert.equal(hasHan(r),Boolean(i%2)));
});
test('English AI instructions retain the schema and override Chinese output instructions',async()=>{
  let input;
  await llm({RESPONSE_LOCALE:'en',AI:{run:async(_model,p)=>{input=p;return {content:[{type:'text',text:'{"answer":"Hello"}'}]};}}},{system:'用中文回答',user:'中文 JSON',kind:'ask'});
  assert.match(input.system,/OUTPUT LANGUAGE: English/);assert.match(input.system,/verdict enum values unchanged/);assert.doesNotMatch(input.system,/中文/);
});
test('English model responses retain words and English-only postprocessing',async()=>{
  const request=async(path,body,output)=>{
    const env={AI:{run:async()=>({content:[{type:'text',text:JSON.stringify(output)}]})}};
    const response=await handle(new Request('http://local/api/ai/'+path,{method:'POST',body:JSON.stringify({...body,locale:'en'})}),env);
    const result=await response.json();assert.equal(hasHan(result),false,path);assert.equal(result.error,undefined,path);return result;
  };
  const commentary=await request('commentary',{names:['Rocket','Titan'],summary:{result:{winner:0,reason:'spin',time:10}}},{headline:'Rocket keeps spinning',story:['Your Rocket is still upright.'],science:{cardId:'ph-inertia',body:'Mass farther from the center increases rotational inertia.'},tryNext:'Try a needle bit on your Rocket.'});
  assert.match(commentary.science.body,/\(in this model\)/);
  assert.equal(commentary.tryNext,'Try a needle bit on your Rocket.');
  const experiment=await request('experiment',{names:['Rocket','Titan'],variable:{key:'bit',label:'Bit',from:'flat',to:'needle'},stats:{A:{wins:1,trials:3},B:{wins:2,trials:3}}},{conclusion:'The modified top won more trials.',repeatLesson:'Repeating a trial helps check the pattern.',dataWhy:'The needle bit loses less spin to friction.',nextIdea:'Change the outer rim weight next.'});
  assert.match(experiment.conclusion,/\(in this model\)/);
  const panels=['You tapped the outer rim.','Weight farther out increases rotational inertia.','That helps the top resist slowing down.'];
  const book=await request('flip/tap',{chapter:'inertia',x:0.5,y:0.5,spots:[{x:0.5,y:0.5,label:'Outer rim',cardId:'ph-inertia'}]},{tapped:'Outer rim',related:true,cardId:'ph-inertia',title:'The outer rim',panels});
  assert.deepEqual(book.page.panels.map(p=>p.text),panels);
});
const sketchResponse=async(locale,specialMove)=>{
  const output={name:'Dragon',zh:locale==='en'?'Dream Dragon':'梦想龙',lore:locale==='en'?'A dragon from your drawing.':'画里的龙。',
    style:'attack',look:{emblem:'dragon'},specialMove};
  const env={AI:{run:async()=>({content:[{type:'text',text:JSON.stringify(output)}]})}};
  const response=await handle(new Request('http://local/api/ai/sketch',{method:'POST',body:JSON.stringify({locale,
    imageDataUrl:'data:image/png;base64,aW1hZ2U=',keepParts:{ratchet:{height:70,prongs:4},bit:'needle'}})}),env);
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.error,undefined);assert.equal(result.via,'claude');
  assert.deepEqual(result.bey.ratchet,{height:70,prongs:4});assert.equal(result.bey.bit,'needle');
  return result.bey;
};
test('sketch preserves complete English move names and shouts through the route',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const specialMove={name:'Dragon Lightning Strike',shout:'Dragon power, unleash the lightning!'};
  const bey=await sketchResponse('en',specialMove);
  assert.deepEqual(bey.specialMove,specialMove);
  assert.equal(bey.drawn,true);assert.equal(hasHan(bey),false);
});
test('sketch applies word-aware English limits, Chinese limits, and move fallbacks',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const english={name:'Dragon Lightning Strike across the Endless Thunder Mountain',
    shout:'Dragon power, unleash the lightning and send a mighty thunderstorm racing across the entire arena to the distant mountains!'};
  const bey=await sketchResponse('en',english);
  assert.deepEqual(bey.specialMove,{name:'Dragon Lightning Strike across the Endless…',
    shout:'Dragon power, unleash the lightning and send a mighty thunderstorm racing across the entire arena…'});
  const chinese=await sketchResponse('zh-CN',{name:'一二三四五六七八九十十一',shout:'一二三四五六七八九十一二三四五六七八九十一'});
  assert.deepEqual(chinese.specialMove,{name:'一二三四五六七八九…',shout:'一二三四五六七八九十一二三四五六七八九…'});
  const fallback=await sketchResponse('en',undefined);
  assert.deepEqual(fallback.specialMove,createFallback('en').specialMoveFor(fallback.look,fallback.type));
});
test('English speech voice selection prefers an English voice, never a Chinese voice',()=>{
  const voices=[{lang:'zh-CN',name:'Chinese'},{lang:'en-GB',name:'British'},{lang:'en-US',name:'English'}];
  assert.equal(speechVoice({getVoices:()=>voices},'en-US').name,'English');
  assert.equal(speechVoice({getVoices:()=>voices.slice(0,1)},'en-US'),null);
});
test('TTS uses the configured English reference, language-scoped cache, and a safe browser fallback',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;let payload,cacheURL;
  globalThis.fetch=async(_url,opts)=>{payload=JSON.parse(opts.body);return new Response(new Uint8Array([1,2]),{headers:{'content-type':'audio/mpeg'}});};
  globalThis.caches={default:{match:async req=>{cacheURL=req.url;return null;},put:async()=>{}}};
  const req=()=>new Request('http://local/api/tts',{method:'POST',headers:{origin:'http://local','content-type':'application/json'},body:JSON.stringify({locale:'en',voice:'doctor',text:'Hello, explorer!'})});
  try {
    const ctx={waitUntil:p=>p};
    assert.equal((await tts(req(),{FISH_API_KEY:'fixture'},ctx)).status,503);
    assert.equal((await tts(req(),{FISH_API_KEY:'fixture',FISH_EN_VOICE_ID:'english-voice'},ctx)).status,200);
    assert.equal(payload.reference_id,'english-voice');assert.equal(payload.text,'Hello, explorer!');assert.match(cacheURL,/tts\.cache/);
  } finally {globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
