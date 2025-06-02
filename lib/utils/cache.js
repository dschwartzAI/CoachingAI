// Simple in-memory cache with TTL (Time To Live)
class SimpleCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlMs = 300000) { // Default 5 minutes TTL
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const profileCache = new SimpleCache();

// Clean up expired entries every 10 minutes
if (typeof global !== 'undefined') {
  if (!global.cacheCleanupInterval) {
    global.cacheCleanupInterval = setInterval(() => {
      profileCache.cleanup();
    }, 600000); // 10 minutes
  }
} 