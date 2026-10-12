import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENES, sceneByKey} from '../src/game/scenes.js';
import {FLAVOR} from '../src/explore/flavor.js';
import {localizeExploreState} from '../src/explore/localization.js';
import {bankGate, GATE_BANK} from '../src/ai/fallback.js';
import {mapLabels} from '../src/explore/mapLabels.js';
import {translate} from '../src/i18n/index.js';

function savedScene(region, scene) {
  const flavor = FLAVOR[region][scene.key];
  return {id:`saved-${scene.key}`, sceneKey:scene.key, title:flavor.title,
    panels:[{text:flavor.panel, kind:'caption'}], line:flavor.spots[0].line,
    tapped:scene.spots[0].label, tried:[0],
    hotspots:scene.spots.map((spot, i)=>({...spot, spot:i})),
    exits:scene.exits.map(key=>({key, title:sceneByKey(region,key).title})),
  };
}

test('old exploration saves display English scene prose without changing progress or source data',()=>{
  for (const [region, scenes] of Object.entries(SCENES)) {
    const original = {v:2,scene:scenes[0].key,visited:scenes.map(s=>s.key),
      hidePlan:[{type:'bey',id:'fish',scene:scenes[1].key,spot:2}], hint:{fish:1}, tries:{fish:3},
      trail:scenes.map(scene=>savedScene(region,scene)), narration:FLAVOR[region][scenes[0].key].narration,
      done:[{id:'hop',type:'blader',name:'跳跳',where:'退潮小路'}],
      pendingGate:{quizId:'tides-1',cardId:'geo-tides',lead:'博士的小考验！答对得 🪙10',q:'潮汐是什么？',
        options:['月亮','海浪'],answer:0,explain:'涨潮时，这条路整个被海水盖住了，真有意思！'},
    };
    const before=JSON.stringify(original), display=localizeExploreState(original,'en');
    assert.equal(JSON.stringify(original),before);
    for (const key of ['scene','visited','hidePlan','hint','tries']) assert.deepEqual(display[key],original[key]);
    for (const [i,page] of display.trail.entries()) {
      assert.doesNotMatch(JSON.stringify([page.title,page.line,page.panels,page.hotspots.map(h=>h.label),page.exits.map(e=>e.title)]),/[\u3400-\u9fff]/,page.sceneKey);
      assert.equal(page.id,original.trail[i].id);assert.equal(page.sceneKey,original.trail[i].sceneKey);
      assert.deepEqual(page.tried,[0]);
      assert.deepEqual(page.hotspots.map(({x,y,spot})=>({x,y,spot})),original.trail[i].hotspots.map(({x,y,spot})=>({x,y,spot})));
    }
    assert.equal(display.done[0].name,'Hop');assert.equal(display.done[0].where,'Low-tide path');
    assert.equal(display.pendingGate.answer,0);assert.equal(display.pendingGate.quizId,'tides-1');
    assert.deepEqual(display.pendingGate.options,['The Moon','Waves']);
  }
});

test('English saved exploration prose also switches back to Chinese',()=>{
  const original={v:2,trail:[savedScene('harbor',sceneByKey('harbor','high_tide'))],
    narration:'涨潮时，这条路整个被海水盖住了，真有意思！',
    done:[{id:'hop',type:'blader',name:'跳跳',where:'退潮小路'}],
  };
  const english=localizeExploreState(original,'en');
  const chinese=localizeExploreState(english,'zh-CN');
  assert.equal(chinese.narration,original.narration);
  assert.equal(chinese.trail[0].title,original.trail[0].title);
  assert.deepEqual(chinese.trail[0].hotspots,original.trail[0].hotspots);
  assert.deepEqual(chinese.done,original.done);
});

test('saved dynamic discovery messages translate their nested names and spots',()=>{
  const gm={v:2,narration:'找到啦！跳跳 就藏在「淹没的小路」里！'};
  const english=localizeExploreState(gm,'en');
  assert.doesNotMatch(english.narration,/[\u3400-\u9fff]/);
  assert.match(english.narration,/Hop/);assert.match(english.narration,/Submerged path/);
  assert.equal(localizeExploreState(english,'zh-CN').narration,gm.narration);
});

test('resuming a pending Chinese exploration quiz translates prose but preserves answers',()=>{
  for (const cardId of Object.keys(GATE_BANK)) {
    const gate=bankGate(cardId,'','博士的小考验！答对得 🪙10',[]);
    const translated=localizeExploreState({pendingGate:gate},'en').pendingGate;
    assert.doesNotMatch(JSON.stringify(translated),/[\u3400-\u9fff]/,cardId);
    assert.equal(translated.answer,gate.answer);assert.equal(translated.quizId,gate.quizId);
    assert.equal(translated.options.length,gate.options.length);
  }
});

test('English minimap labels stay inside the map and do not overlap each other',()=>{
  for (const scenes of Object.values(SCENES)) for (const here of scenes.map(s=>s.key)) {
    const nodes=scenes.map(s=>({...s,title:translate(s.title,[],'en'),x:18+s.pos.x*264,y:18+s.pos.y*284}));
    const boxes=Object.values(mapLabels(nodes,{width:300,height:320,here,hereText:'You are here',english:true}));
    for(const [i,b] of boxes.entries()) {
      assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=300&&b.y+b.h<=320,here);
      for(const a of boxes.slice(0,i)) assert.ok(b.x+b.w<=a.x||a.x+a.w<=b.x||b.y+b.h<=a.y||a.y+a.h<=b.y,here);
    }
  }
});
