// id identifies a design; uid identifies the owned copy, including workshop variants.
export const selectionKey = bey => bey.uid || bey.id;
export const selectedParents = (collection, picked) => picked.map(key => collection.find(bey => selectionKey(bey) === key)).filter(Boolean);
export const toggleParent = (picked, key) => picked.includes(key)
  ? picked.filter(value => value !== key)
  : picked.length < 2 ? [...picked, key] : [picked[1], key];
