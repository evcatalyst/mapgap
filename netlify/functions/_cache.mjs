const DEFAULT_MAX_ENTRIES = 200;

export function getTtlMs(envName, fallbackSeconds) {
  const raw = process.env[envName];
  const seconds = Number(raw);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return fallbackSeconds * 1000;
  }

  return Math.min(seconds, 86400) * 1000;
}

export function makeCacheKey(namespace, value) {
  return `${namespace}:${stableStringify(value)}`;
}

export function getCached(cache, key) {
  const entry = cache.get(key);
  const now = Date.now();

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }

  entry.lastAccessedAt = now;
  return {
    value: cloneJson(entry.value),
    meta: cacheMeta(entry, true, now),
  };
}

export function setCached(cache, key, value, ttlMs, maxEntries = DEFAULT_MAX_ENTRIES) {
  const now = Date.now();
  const entry = {
    value: cloneJson(value),
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: now + ttlMs,
    ttlMs,
  };

  cache.set(key, entry);
  pruneCache(cache, maxEntries);

  return {
    value: cloneJson(value),
    meta: cacheMeta(entry, false, now),
  };
}

export function withCacheMetadata(payload, meta) {
  return {
    ...payload,
    cache: {
      hit: meta.hit,
      generatedAt: new Date(meta.createdAt).toISOString(),
      expiresAt: new Date(meta.expiresAt).toISOString(),
      ttlSeconds: Math.round(meta.ttlMs / 1000),
    },
  };
}

export function cacheHeaders(meta, baseHeaders = {}) {
  return {
    ...baseHeaders,
    "X-MapGap-Cache": meta.hit ? "hit" : "miss",
    "X-MapGap-Cache-Generated-At": new Date(meta.createdAt).toISOString(),
    "X-MapGap-Cache-TTL": String(Math.round(meta.ttlMs / 1000)),
  };
}

function cacheMeta(entry, hit, now) {
  return {
    hit,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    ttlMs: entry.ttlMs,
    ageMs: Math.max(0, now - entry.createdAt),
  };
}

function pruneCache(cache, maxEntries) {
  if (cache.size <= maxEntries) {
    return;
  }

  const entries = Array.from(cache.entries()).sort(
    ([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt,
  );
  const removeCount = cache.size - maxEntries;

  for (const [key] of entries.slice(0, removeCount)) {
    cache.delete(key);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }

  return value;
}
