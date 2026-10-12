// Prepend globalThis.E2E_SPACE_ID = <existing space id>; then pipe to ego-browser nodejs.
// Requires Vite (4195) and the offline server or live Wrangler worker (8795).
const fs=await import('node:fs/promises');
const task=await taskSpace(Number(globalThis.E2E_SPACE_ID));
const page=task.page(globalThis.E2E_PAGE || 'p1');
const out=globalThis.E2E_ARTIFACTS || '/tmp/kos-i18n/e2e';await fs.mkdir(out,{recursive:true});
await page.goto('http://127.0.0.1:4195/src/testing/sandbox.html?screen=map');
await page.waitForSelector('.wm');
if(await page.evaluate(()=>document.documentElement.lang)!=='en'){
  await page.selectOption('select[aria-label="Language / 语言"]','en');
  await page.waitForFunction(()=>document.documentElement.lang==='en'&&!!document.querySelector('.wm'));
}
const records=[];
for(const [name,width,height]of [['ipad-portrait',820,1180],['ipad-landscape',1180,820],['phone',390,844]]){
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  for(const [screen,selector]of [['map','.wm'],['collection','.cw-page'],['shop','.bx-page'],['codex','.codex'],['explore','.ex'],['versus','.vx'],['fusion','.fusion']]){
    await page.goto('http://127.0.0.1:4195/src/testing/sandbox.html?screen='+screen);
    await page.waitForSelector(selector);
    await page.waitForFunction(()=>document.fonts.status==='loaded');
    // A mounted root can still be mid-entrance. Preserve motion in the app, but
    // capture after finite animations, visible images, and typed prose settle.
    await page.waitForFunction(()=>{
      const entering=document.getAnimations().some(a=>
        (a.pending||a.playState==='running')&&Number.isFinite(a.effect?.getTiming().iterations));
      const images=[...document.images].filter(img=>img.getBoundingClientRect().width>0);
      const typing=[...document.querySelectorAll('.ex-caret')].some(el=>el.textContent);
      return !entering&&!typing&&images.every(img=>img.complete);
    },undefined,{timeout:15000});
    if(screen==='versus')await page.waitForFunction(()=>
      document.querySelectorAll('.vx-entry .ks-showcase').length===2&&
      [...document.querySelectorAll('canvas')].some(canvas=>canvas.width>0&&canvas.height>0));
    const snapshot=await page.snapshot();
    await fs.writeFile(`${out}/${name}-${screen}.txt`,snapshot);
    const state=await page.evaluate(()=>({lang:document.documentElement.lang,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:!!document.querySelector('vite-error-overlay'),text:document.body.innerText}));
    if(state.lang!=='en'||state.errors)throw Error(name+' '+screen+' did not render in English');
    const record={name,screen,width,scrollWidth:state.scrollWidth,overflow:state.scrollWidth>width+1};records.push(record);
    await page.screenshot({path:`${out}/${name}-${screen}.png`});
    console.log(record);
  }
}
await fs.writeFile(`${out}/layout.json`,JSON.stringify(records,null,2));
if(records.some(r=>r.overflow))throw Error('Horizontal overflow detected; see layout.json');
