/** Fixed windows per socket address and API route; never trusts forwarded headers. */
export function createRateLimiter({
  limit = 30,
  windowMs = 60000,
  maxEntries = 10000,
  now = Date.now,
} = {}) {
  if (
    ![limit, windowMs, maxEntries].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new TypeError("Rate limits must be positive integers");
  const entries = new Map();
  let nextCleanup = 0;
  return function consume(key) {
    const time = now();
    if (time >= nextCleanup) {
      for (const [id, entry] of entries)
        if (entry.expires <= time) entries.delete(id);
      nextCleanup = time + Math.min(windowMs, 1000);
    }
    let entry = entries.get(key);
    if (entry && entry.expires <= time) {
      entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      // Reject new keys at capacity instead of evicting active limits.
      if (entries.size >= maxEntries)
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil(windowMs / 1000)),
        };
      entry = { count: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= limit)
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((entry.expires - time) / 1000)),
      };
    entry.count++;
    return { allowed: true };
  };
}
