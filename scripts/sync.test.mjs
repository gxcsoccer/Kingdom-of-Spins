import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {installGlobal, memoryStorage, deferred} from './helpers/fakes.mjs';
import {setAuthBackend} from './helpers/auth-stub.mjs';

register('./helpers/test-loader.mjs', import.meta.url);
let useGame, freshSave;
let sequence = 0;
const kid = id => ({id, nickname: id, avatar: '1'});

async function setup(t) {
  t.mock.timers.enable({apis: ['setTimeout']});
  const events = new EventTarget(), storage = memoryStorage(), writes = [];
  installGlobal(t, 'localStorage', storage);
  installGlobal(t, 'addEventListener', events.addEventListener.bind(events));
  installGlobal(t, 'removeEventListener', events.removeEventListener.bind(events));
  ({useGame, freshSave} = await import('../src/game/store.js'));
  const backend = {
    loadSave: async () => ({data: freshSave(), error: null}),
    writeSave: async (id, data) => { writes.push({id, data: structuredClone(data)}); return {data: {}, error: null}; },
    getSession: async () => ({data: {user: {id: 'parent'}}}),
    listKids: async () => ({data: [kid('A'), kid('B')]}),
  };
  setAuthBackend(backend);
  useGame.setState({saveKey: 'kos-save-v1', save: freshSave(), activeKid: null, onChange: null});
  const sync = await import(`../src/game/sync.js?test=${++sequence}`);
  return {sync, backend, writes, storage, hide: () => events.dispatchEvent(new Event('pagehide'))};
}

test('cloud sync debounces changes and stores the latest complete save', async t => {
  const {sync, writes, storage} = await setup(t);
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(10);
  t.mock.timers.tick(1000);
  useGame.getState().addCoins(20);
  t.mock.timers.tick(1499);
  assert.equal(writes.length, 0);
  assert.equal(JSON.parse(storage.getItem('kos-save-kid-A')).coins, 30);
  t.mock.timers.tick(1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, 'A');
  assert.equal(writes[0].data.coins, 30);
});

test('switching kids flushes the outgoing save before queuing another kid', async t => {
  const {sync, writes} = await setup(t);
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(11);
  await sync.activateKid(kid('B'));
  useGame.getState().addCoins(22);
  t.mock.timers.tick(1500);
  assert.deepEqual(writes.map(w => [w.id, w.data.coins]), [['A', 11], ['B', 22]]);
});

test('pagehide never writes the current kid into a previous kid slot', async t => {
  const {sync, writes, hide} = await setup(t);
  await sync.activateKid(kid('A'));
  await sync.activateKid(kid('B'));
  useGame.getState().addCoins(22);
  hide();
  assert.deepEqual(writes.map(w => [w.id, w.data.profile.kidId, w.data.coins]), [['B', 'B', 22]]);
  t.mock.timers.tick(1500);
  assert.equal(writes.length, 1, 'pagehide must consume the pending write only once');
});

test('signing out flushes pending progress before returning to the guest slot', async t => {
  const {sync, writes} = await setup(t);
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(17);
  sync.deactivateKid();
  t.mock.timers.tick(1500);
  assert.deepEqual(writes.map(w => [w.id, w.data.coins]), [['A', 17]]);
  assert.equal(useGame.getState().activeKid, null);
  assert.equal(useGame.getState().saveKey, 'kos-save-v1');
});

test('a failed cloud read must not upload a stale local save over unseen cloud progress', async t => {
  const {sync, backend, writes, storage} = await setup(t);
  backend.loadSave = async () => ({data: null, error: {message: 'offline'}});
  storage.setItem('kos-save-kid-A', JSON.stringify({...freshSave(), coins: 5}));
  const result = await sync.activateKid(kid('A'));
  assert.equal(result.error.message, 'offline');
  useGame.getState().addCoins(2);
  t.mock.timers.tick(1500);
  assert.equal(useGame.getState().save.coins, 7, 'local play should still work');
  assert.equal(writes.length, 0, 'a failed read does not mean there is no cloud save');
});

test('a new kid with no cloud record receives its first save', async t => {
  const {sync, backend, writes} = await setup(t);
  backend.loadSave = async () => ({data: null, error: null});
  await sync.activateKid(kid('A'));
  t.mock.timers.tick(1500);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, 'A');
  assert.equal(writes[0].data.profile.kidId, 'A');
});

test('the last selected kid wins even when cloud reads resolve out of order', async t => {
  const {sync, backend} = await setup(t);
  const first = deferred();
  backend.loadSave = id => id === 'A' ? first.promise : Promise.resolve({data: {...freshSave(), coins: 20}, error: null});
  const earlier = sync.activateKid(kid('A'));
  await new Promise(setImmediate);
  await sync.activateKid(kid('B'));
  first.resolve({data: {...freshSave(), coins: 10}, error: null});
  await earlier;
  assert.equal(useGame.getState().activeKid.id, 'B');
  assert.equal(useGame.getState().save.coins, 20);
});

test('signing out cancels an in-flight kid activation', async t => {
  const {sync, backend, storage} = await setup(t);
  const read = deferred();
  backend.loadSave = () => read.promise;
  const activation = sync.activateKid(kid('A'));
  await new Promise(setImmediate);
  sync.deactivateKid();
  read.resolve({data: freshSave(), error: null});
  await activation;
  assert.equal(useGame.getState().activeKid, null);
  assert.equal(useGame.getState().saveKey, 'kos-save-v1');
  assert.equal(storage.getItem('kos-last-kid'), null);
});

test('slow cloud writes are serialized so older progress cannot overwrite newer progress', async t => {
  const {sync, backend, writes} = await setup(t);
  const first = deferred();
  backend.writeSave = async (id, data) => {
    writes.push({id, data: structuredClone(data)});
    if (writes.length === 1) await first.promise;
    return {data: {}, error: null};
  };
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(10);
  t.mock.timers.tick(1500);
  useGame.getState().addCoins(20);
  t.mock.timers.tick(1500);
  assert.equal(writes.length, 1, 'the second write must wait for the first');
  first.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(writes.map(w => w.data.coins), [10, 30]);
});

test('destructive profile actions discard queued saves and wait for outstanding writes', async t => {
  const {sync, backend, writes, hide} = await setup(t);
  const first = deferred();
  backend.writeSave = async (id, data) => { writes.push({id, data}); await first.promise; return {data: {}, error: null}; };
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(10);
  t.mock.timers.tick(1500);
  useGame.getState().addCoins(20);
  let stopped = false;
  const stopping = sync.deactivateKid({discardPending: true}).then(() => { stopped = true; });
  await new Promise(setImmediate);
  assert.equal(stopped, false, 'reset/delete must wait for writes already sent');
  first.resolve();
  await stopping;
  hide(); t.mock.timers.tick(1500);
  assert.equal(writes.length, 1, 'queued progress must not undo a reset');
});

test('startup restoration cannot replace a kid explicitly selected while auth was loading', async t => {
  const {sync, backend, storage} = await setup(t);
  const session = deferred();
  storage.setItem('kos-last-kid', 'A');
  backend.getSession = () => session.promise;
  const restoring = sync.restoreLastKid();
  await sync.activateKid(kid('B'));
  session.resolve({data: {user: {id: 'parent'}}});
  assert.equal(await restoring, null);
  assert.equal(useGame.getState().activeKid.id, 'B');
});

test('rapidly switching back waits for the outgoing cloud write before reading the same slot', async t => {
  const {sync, backend} = await setup(t);
  const sent = deferred(), reads = [];
  let remote = freshSave();
  backend.loadSave = async id => { reads.push(id); return {data: structuredClone(remote), error: null}; };
  backend.writeSave = async (id, data) => { await sent.promise; remote = data; return {data: {}, error: null}; };
  await sync.activateKid(kid('A'));
  useGame.getState().addCoins(30);
  const switching = sync.activateKid(kid('B'));
  const returning = sync.activateKid(kid('A'));
  await new Promise(setImmediate);
  assert.deepEqual(reads, ['A'], 'the outgoing save must settle before another activation reads it');
  sent.resolve();
  await Promise.all([switching, returning]);
  assert.equal(useGame.getState().activeKid.id, 'A');
  assert.equal(useGame.getState().save.coins, 30);
});
