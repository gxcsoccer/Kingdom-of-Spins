import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleRunner} from '../src/game/battleRunner.js';
import {deferred} from './helpers/fakes.mjs';

function harness(options = {}) {
  const instances = [], messages = [], pauses = [];
  class FakeBattle {
    constructor(module, {maxTime = 2}) {
      this.samples = []; this.events = []; this.ended = null;
      this.steps = 0; this.maxTime = maxTime; this.disposals = 0;
      instances.push(this);
    }
    advance() {
      if (options.failAdvance) throw new Error('physics failed');
      this.steps++;
      this.samples.push({time:this.steps, bodies:[{p:[1,2,3], q:[1,0,0,0], rpm:4000, tilt:0}]});
      this.events.push({time:this.steps, type:'collision'});
      if (this.steps >= this.maxTime) this.ended = {winner:0, reason:'spin'};
    }
    summary() { return {steps:this.steps}; }
    dispose() { if (++this.disposals > 1) throw new Error('double free'); }
  }
  const runner = createBattleRunner({load:options.load || (async () => ({})), Battle:FakeBattle,
    postMessage:message => messages.push(message),
    yieldNow:() => { const pause = deferred(); pauses.push(pause); return pause.promise; },
  });
  const step = async () => { assert.ok(pauses.length, 'simulation yielded'); pauses.shift().resolve(); await Promise.resolve(); };
  return {runner, instances, messages, step};
}

test('a completed worker run streams each sample once and disposes once', async () => {
  const h = harness(), run = h.runner.run({id:1});
  await Promise.resolve();
  await h.step();
  await h.step();
  await run;
  assert.deepEqual(h.messages.filter(m => m.type === 'chunk').flatMap(m => m.samples.map(s => s.time)), [1,2]);
  assert.deepEqual(h.messages.at(-1), {type:'done', id:1, result:{winner:0, reason:'spin'}, summary:{steps:2}});
  assert.equal(h.instances[0].disposals, 1);
});

test('canceling a streaming battle frees its resources exactly once', async () => {
  const h = harness(), run = h.runner.run({id:1});
  await Promise.resolve();
  h.runner.cancel(1);
  await h.step();
  await run;
  assert.equal(h.instances[0].disposals, 1);
  assert.deepEqual(h.messages.map(m => m.type), ['chunk']);
});

test('canceling while the module loads does not allocate a battle', async () => {
  const module = deferred(), h = harness({load:() => module.promise});
  const run = h.runner.run({id:1});
  h.runner.cancel(1);
  module.resolve({});
  await run;
  assert.equal(h.instances.length, 0);
  assert.equal(h.messages.length, 0);
});

test('late cleanup of the old battle cannot cancel the replacement', async () => {
  const h = harness(), old = h.runner.run({id:1});
  await Promise.resolve();
  const next = h.runner.run({id:2, maxTime:1});
  await Promise.resolve();
  h.runner.cancel(1);
  await h.step();
  await h.step();
  await Promise.all([old, next]);
  assert.deepEqual(h.messages.filter(m => m.type === 'done').map(m => m.id), [2]);
  assert.deepEqual(h.instances.map(b => b.disposals), [1,1]);
});

test('canceling after the last chunk suppresses a stale completion', async () => {
  const h = harness(), run = h.runner.run({id:1, maxTime:1});
  await Promise.resolve();
  h.runner.cancel(1);
  await h.step();
  await run;
  assert.equal(h.messages.some(m => m.type === 'done'), false);
  assert.equal(h.instances[0].disposals, 1);
});

test('simulation failures report the request ID and release allocated physics', async () => {
  const h = harness({failAdvance:true});
  await h.runner.run({id:7});
  assert.deepEqual(h.messages, [{type:'error', id:7, message:'physics failed'}]);
  assert.equal(h.instances[0].disposals, 1);
});

test('module failures report an error without allocating physics', async () => {
  const h = harness({load:async () => { throw new Error('wasm unavailable'); }});
  await h.runner.run({id:8});
  assert.deepEqual(h.messages, [{type:'error', id:8, message:'wasm unavailable'}]);
  assert.equal(h.instances.length, 0);
});
