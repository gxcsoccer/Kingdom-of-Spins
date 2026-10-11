// The same battle URL can be opened by multiple children on a shared device.
export const resultCacheKey = (slot, pathname, search = '') => `kos-result:${JSON.stringify([slot, pathname, search])}`;
