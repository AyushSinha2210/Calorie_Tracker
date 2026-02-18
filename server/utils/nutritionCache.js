const cache = new Map();
const CACHE_TTL = 86400000;

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

export const setCache = (key, data) => cache.set(key, { data, timestamp: Date.now() });
export const clearCache = () => cache.clear();
