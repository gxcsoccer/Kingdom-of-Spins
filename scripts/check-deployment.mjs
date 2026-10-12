import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const production='https://kingdom-of-spins.deskmind-site.workers.dev';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function checkDeployment({origin=production,dist='dist',fetcher=fetch}={}) {
  const base=new URL(origin);
  const get=async path=>{
    const response=await fetcher(new URL(path,base),{signal:AbortSignal.timeout(30000),cache:'no-store'});
    assert.equal(response.status,200,`HTTP check failed: ${path}`);
    return response;
  };
  const health=await (await get('/api/health')).json();
  assert.equal(health.service,'kingdom-of-spins');
  assert.ok(health.ok&&health.ai&&health.rooms,'Worker health or bindings unavailable');
  const localHtml=await readFile(resolve(dist,'index.html'),'utf8');
  const entries=[...localHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
  assert.ok(entries.length,'No production entry assets found');
  const liveHtml=await (await get('/')).text();
  for(const entry of entries)assert.ok(liveHtml.includes(entry),`Old or incomplete frontend: ${entry}`);
  const clips=(await readdir(resolve(dist,'audio/vo/en'))).filter(name=>name.endsWith('.mp3'));
  assert.ok(clips.length,'English voice clips are missing from the build');
  const files=[...new Set([...entries,'/art/logo.png',...clips.map(name=>'/audio/vo/en/'+name)])];
  await Promise.all(files.map(async path=>{
    const expected=await readFile(resolve(dist,'.'+path));
    const actual=Buffer.from(await (await get(path)).arrayBuffer());
    assert.equal(sha(actual),sha(expected),`Deployed asset differs from this build: ${path}`);
  }));
  return {origin:base.origin,assets:files.length,englishClips:clips.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const result=await checkDeployment({origin:process.argv[2]||production});
      console.log(`Deployment verified: ${result.origin}; health, ${result.assets} assets, ${result.englishClips} English clips.`);
      break;
    }catch(error){
      console.error(`Deployment check ${attempt}/4: ${error.message}`);
      if(attempt===4)process.exitCode=1;
      else await delay(5000);
    }
  }
}
