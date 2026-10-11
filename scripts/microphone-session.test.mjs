import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicrophoneSession} from '../src/game/microphoneSession.js';
import {deferred} from './helpers/fakes.mjs';

function harness(overrides = {}) {
  const calls = {track:0, meter:0, recognition:0, ended:0, text:[]};
  const stream = {getTracks:() => [{stop:() => calls.track++}]};
  let callbacks;
  const session = createMicrophoneSession({
    getUserMedia:async () => stream,
    startMeter:() => () => calls.meter++,
    listen:handlers => { callbacks = handlers; return {stop:() => { calls.recognition++; handlers.onEnd(); }}; },
    onText:text => calls.text.push(text),
    onEnd:() => calls.ended++,
    ...overrides,
  });
  return {session, calls, stream, get callbacks() { return callbacks; }};
}

test('natural recognition end releases the stream and meter exactly once', async () => {
  const h = harness();
  await h.session.start();
  h.callbacks.onEnd();
  h.session.stop();
  h.callbacks.onText('shoot');
  assert.equal(h.session.active, false);
  assert.deepEqual(h.calls, {track:1, meter:1, recognition:1, ended:1, text:[]});
});

test('permission granted after leaving immediately stops the new stream', async () => {
  const permission = deferred();
  let meters = 0, recognitions = 0;
  const h = harness({getUserMedia:() => permission.promise,
    startMeter:() => { meters++; }, listen:() => { recognitions++; }});
  const start = h.session.start();
  h.session.stop();
  permission.resolve(h.stream);
  await start;
  assert.equal(h.calls.track, 1);
  assert.equal(meters, 0);
  assert.equal(recognitions, 0);
});

test('restarting capture closes the old session and ignores its late events', async () => {
  const h = harness();
  await h.session.start();
  const old = h.callbacks;
  await h.session.start();
  old.onText('old shoot');
  old.onEnd();
  assert.equal(h.session.active, true);
  h.callbacks.onText('new shoot');
  h.session.stop();
  assert.deepEqual(h.calls, {track:2, meter:2, recognition:2, ended:2, text:['new shoot']});
});

test('unsupported recognition releases the separate recording stream', async () => {
  const h = harness({listen:() => null});
  await h.session.start();
  assert.equal(h.session.active, false);
  assert.equal(h.calls.track, 1);
  assert.equal(h.calls.meter, 1);
});

test('recognition remains usable when the loudness permission fails', async () => {
  const h = harness({getUserMedia:async () => { throw new Error('denied'); }});
  await h.session.start();
  h.callbacks.onText('shoot');
  h.session.stop();
  assert.deepEqual(h.calls.text, ['shoot']);
  assert.equal(h.calls.track, 0);
  assert.equal(h.calls.ended, 1);
});

test('a meter initialization error still releases its stream', async () => {
  const h = harness({startMeter:() => { throw new Error('audio context'); }});
  await h.session.start();
  h.session.stop();
  assert.equal(h.calls.track, 1);
});
