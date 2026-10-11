import test from 'node:test';
import assert from 'node:assert/strict';
import {installGlobal} from './helpers/fakes.mjs';

let revision = 0;
async function harness(t) {
  const workers = [];
  class Worker {
    listeners = new Map();
    messages = [];
    terminated = false;
    constructor() { workers.push(this); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    postMessage(data) { this.messages.push(data); }
    terminate() { this.terminated = true; }
    emit(type, event) { for (const fn of [...(this.listeners.get(type) || [])]) fn(event); }
  }
  installGlobal(t, 'Worker', Worker);
  const {createBattle} = await import(`../src/game/battlePlayer.js?test=${++revision}`);
  return {create:() => createBattle({beys:[], launches:[]}), workers};
}

test('disposing an old player cancels only its request and is idempotent', async t => {
  const h = await harness(t), first = h.create(), second = h.create(), w = h.workers[0];
  const runs = w.messages.filter(m => m.type === 'run');
  first.dispose(); first.dispose();
  assert.deepEqual(w.messages.filter(m => m.type === 'cancel'), [{type:'cancel', id:runs[0].id}]);
  w.emit('message', {data:{type:'done', id:runs[1].id, result:{winner:0}, summary:{}}});
  assert.equal(second.done, true);
  assert.equal(first.done, false);
  second.dispose();
});

test('a simulation error pauses playback and notifies error listeners without scoring', async t => {
  const h = await harness(t), player = h.create(), w = h.workers[0];
  const run = w.messages.find(m => m.type === 'run'), errors = [];
  let results = 0;
  player.onDone(() => results++); player.onError(error => errors.push(error)); player.start();
  w.emit('message', {data:{type:'error', id:run.id, message:'bad physics'}});
  player.start();
  assert.equal(player.paused, true);
  assert.equal(player.finished, false);
  assert.equal(results, 0);
  assert.deepEqual(errors, ['bad physics']);
  player.dispose();
});

test('a native worker error can be retried with a fresh worker', async t => {
  const h = await harness(t), player = h.create(), oldWorker = h.workers[0], errors = [];
  player.onError(error => errors.push(error));
  oldWorker.emit('error', {message:'worker module failed'});
  const next = h.create();
  assert.equal(oldWorker.terminated, true);
  assert.equal(h.workers.length, 2);
  assert.deepEqual(errors, ['worker module failed']);
  player.dispose(); next.dispose();
});

test('a disposed player ignores late worker errors', async t => {
  const h = await harness(t), player = h.create(), errors = [];
  player.onError(error => errors.push(error));
  player.dispose();
  h.workers[0].emit('error', {message:'late failure'});
  assert.deepEqual(errors, []);
});
