import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionKey, selectedParents, toggleParent} from '../src/fusion/selection.js';

const original = {id:'dragoon', uid:'original', blade:{ring:30}};
const modified = {id:'dragoon', uid:'modified', blade:{ring:80}};

test('fusion selects the modified copy instead of the first matching design', () => {
  const picked = toggleParent([], selectionKey(modified));
  assert.deepEqual(selectedParents([original, modified], picked), [modified]);
});

test('two owned copies of the same design can be independent fusion parents', () => {
  let picked = toggleParent([], selectionKey(original));
  picked = toggleParent(picked, selectionKey(modified));
  assert.deepEqual(selectedParents([original, modified], picked), [original, modified]);
  assert.deepEqual(toggleParent(picked, selectionKey(modified)), ['original']);
});

test('a third choice replaces the oldest parent and keeps selection order', () => {
  assert.deepEqual(toggleParent(['original', 'modified'], 'third'), ['modified', 'third']);
});

test('catalog-only sandbox beys still use their design ID', () => {
  const catalog = {id:'fish'};
  assert.deepEqual(selectedParents([catalog], [selectionKey(catalog)]), [catalog]);
});
