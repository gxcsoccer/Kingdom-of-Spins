import test from 'node:test';
import assert from 'node:assert/strict';
import {createMomentPlayback} from '../src/game/momentPlayback.js';

test('automatic review plays every moment in order and returns to idle', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const played = [], states = [];
  let speechTimer;
  const playback = createMomentPlayback({
    play: moment => {
      // Starting a moment cleans up the previous moment's effects.
      clearTimeout(speechTimer);
      speechTimer = setTimeout(() => {}, 600);
      played.push(moment);
    },
    onPlaying: value => states.push(value),
  });
  playback.start(['first hit', 'big hit', 'finish']);
  t.mock.timers.tick(0);
  assert.deepEqual(played, ['first hit']);
  t.mock.timers.tick(7600);
  t.mock.timers.tick(7600);
  assert.deepEqual(played, ['first hit', 'big hit', 'finish']);
  assert.deepEqual(states, [true]);
  t.mock.timers.tick(7600);
  assert.deepEqual(states, [true, false]);
});

test('stopping or leaving review prevents all remaining moments', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const played = [];
  const playback = createMomentPlayback({play: moment => played.push(moment)});
  playback.start(['first', 'second']);
  t.mock.timers.tick(0);
  playback.stop();
  t.mock.timers.tick(20000);
  assert.deepEqual(played, ['first']);
});

test('restarting review cancels the earlier sequence', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const played = [];
  const playback = createMomentPlayback({play: moment => played.push(moment)});
  playback.start(['old first', 'old second']);
  playback.start(['new']);
  t.mock.timers.tick(0);
  t.mock.timers.tick(20000);
  assert.deepEqual(played, ['new']);
});

test('stopping from a playback callback cannot schedule another moment', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const played = [], states = [];
  const playback = createMomentPlayback({play: moment => { played.push(moment); playback.stop(); }, onPlaying: value => states.push(value)});
  playback.start(['first', 'second']);
  t.mock.timers.tick(0);
  t.mock.timers.tick(20000);
  assert.deepEqual(played, ['first']);
  assert.deepEqual(states, [true, false]);
});
