import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskScope} from '../src/game/taskScope.js';
import {deferred, installGlobal, memoryStorage} from './helpers/fakes.mjs';

test('returning to the main page ignores a pending deeper-branch response', async () => {
  const tasks = createTaskScope(), response = deferred();
  let branch = {levels:['first']}, awards = 0;
  const current = tasks.begin();
  const request = response.promise.then(page => {
    if (!current()) return;
    branch = {...branch, levels:[...branch.levels, page]};
    awards++;
  });
  tasks.cancel();
  branch = null;
  response.resolve('second');
  await request;
  assert.equal(branch, null);
  assert.equal(awards, 0);
});

test('a newer request invalidates the previous page response', () => {
  const tasks = createTaskScope();
  const old = tasks.begin(), latest = tasks.begin();
  assert.equal(old(), false);
  assert.equal(latest(), true);
});

test('leaving the launch screen cancels its cut-in and launch callback', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const tasks = createTaskScope(), events = [];
  tasks.schedule(() => events.push('cut'), 180);
  tasks.schedule(() => events.push('launch'), 1350);
  t.mock.timers.tick(180);
  tasks.dispose();
  t.mock.timers.tick(3000);
  assert.deepEqual(events, ['cut']);
});

test('an active launch executes its delayed callbacks in order', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const tasks = createTaskScope(), events = [];
  tasks.schedule(() => events.push('cut'), 180);
  tasks.schedule(() => events.push('launch'), 1350);
  t.mock.timers.tick(180);
  assert.deepEqual(events, ['cut']);
  t.mock.timers.tick(1170);
  assert.deepEqual(events, ['cut', 'launch']);
});

test('effect teardown and setup do not revive an old request', () => {
  const tasks = createTaskScope(), old = tasks.ticket();
  tasks.dispose();
  assert.equal(tasks.ticket()(), false);
  tasks.resume();
  assert.equal(old(), false);
  assert.equal(tasks.ticket()(), true);
});

test('late experiment rewards cannot enter another kid or a reactivated slot', async t => {
  installGlobal(t, 'localStorage', memoryStorage());
  const {useGame, freshSave} = await import('../src/game/store.js');
  const store = useGame.getState();
  store.useSlot('kid-a', freshSave());
  const tasks = createTaskScope(() => useGame.getState().slotVersion);
  const current = tasks.ticket(), result = deferred();
  const completion = result.promise.then(() => {
    if (current()) useGame.getState().addCoins(15);
  });
  store.useSlot('kid-b', freshSave());
  assert.equal(current(), false);
  store.useSlot('kid-a', freshSave());
  result.resolve();
  await completion;
  assert.equal(useGame.getState().save.coins, 0);
});

test('ordinary save updates do not discard a valid pending reward', async t => {
  installGlobal(t, 'localStorage', memoryStorage());
  const {useGame, freshSave} = await import('../src/game/store.js');
  useGame.getState().useSlot('kid-a', freshSave());
  const tasks = createTaskScope(() => useGame.getState().slotVersion);
  const current = tasks.ticket();
  useGame.getState().addCoins(5);
  assert.equal(current(), true);
});
