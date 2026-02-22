const cache = new Map();
const CACHE_TTL = 86400000;
const MAX_CACHE_SIZE = 500;

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  // Move to end for LRU ordering
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

export function setCache(key, data) {
  // Evict oldest entries if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

export const clearCache = () => cache.clear();
