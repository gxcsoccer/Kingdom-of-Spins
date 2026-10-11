import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../worker/ai.js';
import {sanitizeCandidate, templateFusion, experimentVerdict} from '../src/ai/fallback.js';
import {BEYS} from '../src/game/beys.js';
import {getCard} from '../src/knowledge/cards.js';

const parents = [BEYS.fish, BEYS.dragoon];
const request = (path, body) => new Request(`https://game.test/api/ai/${path}`, {method: 'POST', body: JSON.stringify(body)});

test('fusion rejects invented part changes and preserves the chosen parent parts', () => {
  const before = structuredClone(parents);
  for (const keepParent of [0, 1]) {
    const bey = sanitizeCandidate({name: 'Test', ratchet: {height: 999, prongs: 99}, bit: 'rocket',
      wings: 9, reach: 100, ring: -10, mass: 999, cards: ['invented-card']}, parents, keepParent);
    assert.deepEqual(bey.ratchet, parents[keepParent].ratchet);
    assert.equal(bey.bit, parents[keepParent].bit);
    assert.deepEqual([bey.blade.wings, bey.blade.reach, bey.blade.ring, bey.blade.mass], [3, .03, 20, 40]);
    assert.ok(bey.knowledge.length > 0 && bey.knowledge.every(k => getCard(k.id)));
  }
  assert.deepEqual(parents, before, 'validation must not mutate owned beys');
});

test('a vague wish is clarified once and the follow-up always offers playable candidates', () => {
  const first = templateFusion({parents, wish: '嗯'});
  assert.ok(first.question);
  const next = templateFusion({parents, wish: '嗯', history: [{role: 'assistant', question: first.question}]});
  assert.equal(next.question, undefined);
  assert.equal(next.candidates.length, 3);
  assert.equal(new Set(next.candidates.map(b => b.id)).size, 3);
});

test('fusion remains usable with no AI provider configured', async () => {
  const response = await handle(request('fusion/chat', {parents, wish: '转得持久', keepParent: 1}), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.fallback, true);
  assert.equal(body.candidates.length, 3);
  assert.ok(body.candidates.every(b => b.bit === parents[1].bit));
});

test('provider failures return a fusion template instead of breaking the game', async t => {
  // Timeout timers are virtual; no provider credentials or network are used.
  t.mock.timers.enable({apis: ['setTimeout']});
  let calls = 0;
  const env = {AI: {async run() { calls++; throw new Error('test provider unavailable'); }}};
  const response = await handle(request('fusion/chat', {parents, wish: '防守稳固'}), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(calls >= 1);
  assert.equal(body.fallback, true);
  assert.equal(body.candidates.length, 3);
});

test('AI endpoints reject malformed JSON before invoking a provider', async () => {
  const req = new Request('https://game.test/api/ai/ask', {method: 'POST', body: '{broken'});
  const response = await handle(req, {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'bad json');
});

test('experiment conclusions prioritize wins, then RPM, and never use round duration as quality', () => {
  assert.equal(experimentVerdict({A: {wins: 1, avgRpm3: 6000, avgTime: 20}, B: {wins: 2, avgRpm3: 3000, avgTime: 2}}), 'B更好');
  assert.equal(experimentVerdict({A: {wins: 2, avgRpm3: 5000}, B: {wins: 2, avgRpm3: 5750}}), '差不多');
  assert.equal(experimentVerdict({A: {wins: 2, avgRpm3: 5000}, B: {wins: 2, avgRpm3: 6000}}), 'B更好');
  assert.equal(experimentVerdict({A: {wins: 2, avgRpm3: 5000}, B: {wins: 2, avgRpm3: 4000}}), 'A更好');
});
