import test from 'node:test';
import assert from 'node:assert/strict';
import {resultCacheKey} from '../src/game/resultCache.js';

test('two kids opening the same battle URL cannot restore each other\'s result', () => {
  assert.notEqual(resultCacheKey('kid-a', '/battle/ran'), resultCacheKey('kid-b', '/battle/ran'));
});

test('refresh restores the same slot and route, while different opponents stay separate', () => {
  assert.equal(resultCacheKey('kid-a', '/battle/ran'), resultCacheKey('kid-a', '/battle/ran', ''));
  assert.notEqual(resultCacheKey('kid-a', '/battle/ran'), resultCacheKey('kid-a', '/battle/shu'));
  assert.notEqual(resultCacheKey('kid-a', '/battle', '?mode=a'), resultCacheKey('kid-a', '/battle', '?mode=b'));
});
