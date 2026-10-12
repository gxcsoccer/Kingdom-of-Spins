import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {checkDeployment} from './check-deployment.mjs';

async function fixture(t){
  const dist=await mkdtemp(join(tmpdir(),'kos-deployment-'));
  t.after(()=>rm(dist,{recursive:true,force:true}));
  const html='<script type="module" src="/assets/app-123.js"></script>';
  const files={'/index.html':html,'/assets/app-123.js':'console.log("Kingdom of Spins")',
    '/art/logo.png':'logo fixture','/audio/vo/en/dragon.mp3':'audio fixture'};
  for(const [path,body]of Object.entries(files)){
    const file=join(dist,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,body);
  }
  const live={...files,'/':html,'/api/health':JSON.stringify({ok:true,service:'kingdom-of-spins',ai:true,rooms:true})};
  const check=()=>checkDeployment({origin:'https://game.test',dist,fetcher:async url=>new Response(live[url.pathname]??'missing',{status:url.pathname in live?200:404})});
  return {live,check};
}
test('deployment check verifies health and the exact built assets without AI calls',async t=>{
  const {check}=await fixture(t);
  assert.deepEqual(await check(),{origin:'https://game.test',assets:3,englishClips:1});
});
test('deployment check rejects an old frontend even when health is green',async t=>{
  const {live,check}=await fixture(t);live['/']='<script src="/assets/old.js"></script>';
  await assert.rejects(check,/Old or incomplete frontend/);
});
test('deployment check rejects missing runtime bindings',async t=>{
  const {live,check}=await fixture(t);live['/api/health']=JSON.stringify({ok:true,service:'kingdom-of-spins',ai:true,rooms:false});
  await assert.rejects(check,/Worker health or bindings unavailable/);
});
test('deployment check rejects a missing clip served as SPA HTML with HTTP 200',async t=>{
  const {live,check}=await fixture(t);live['/audio/vo/en/dragon.mp3']=live['/'];
  await assert.rejects(check,/Deployed asset differs/);
});
