import test from 'node:test';
import assert from 'node:assert/strict';
import {BEYS} from '../src/game/beys.js';
import {installGlobal} from './helpers/fakes.mjs';

let revision = 0;
async function harness(t) {
  const workers = [], jobs = [];
  let mode = 'nativeError';
  class Worker {
    listeners = new Map();
    terminated = false;
    constructor() { workers.push(this); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    terminate() { this.terminated = true; }
    postMessage(msg) {
      if (msg.type !== 'sim') return;
      jobs.push(msg);
      queueMicrotask(() => {
        const type = mode === 'nativeError' ? 'error' : 'message';
        const event = mode === 'nativeError' ? {message:'worker load failed'}
          : {data:mode === 'simError' ? {type:'simError', id:msg.id, message:'physics failed'}
            : {type:'simDone', id:msg.id, result:{winner:0, time:3, reason:'spin'}, rpm3:[4000,3000], samples:[], hits:1}};
        for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
      });
    }
  }
  installGlobal(t, 'Worker', Worker);
  installGlobal(t, 'navigator', {hardwareConcurrency:2});
  const {runExperiment} = await import(`../src/game/experiment.js?test=${++revision}`);
  return {workers, jobs, mode(value) { mode = value; }, run:() => runExperiment({
    mine:BEYS.dragoon, opp:BEYS.titan, launches:[{rpm:4800}, {rpm:4500}], key:'ring', value:80, trials:1,
  })};
}

test('native experiment worker failures reject promptly and replacement workers allow retry', async t => {
  const h = await harness(t);
  await assert.rejects(h.run(), /worker load failed/);
  assert.equal(h.workers.filter(w => w.terminated).length, 2);
  h.mode('success');
  const result = await h.run();
  assert.equal(h.workers.length, 4);
  assert.equal(result.stats.A.trials, 1);
  assert.equal(result.stats.B.trials, 1);
  assert.deepEqual(h.jobs[2].launches, h.jobs[3].launches);
});

test('simulation errors release experiment slots for a subsequent run', async t => {
  const h = await harness(t);
  h.mode('simError');
  await assert.rejects(h.run(), /physics failed/);
  h.mode('success');
  assert.equal((await h.run()).verdict, '差不多');
  assert.equal(h.workers.length, 2);
});
