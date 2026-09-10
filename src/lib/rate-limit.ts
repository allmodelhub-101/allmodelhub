import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let limiter: Ratelimit | null | undefined;
const FALLBACK_LIMIT = 30;
const FALLBACK_WINDOW_MS = 60_000;
const fallbackWindows = new Map<string, { count: number; reset: number }>();

function getLimiter() {
  if (limiter !== undefined) return limiter;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    limiter = null;
    return limiter;
  }
  const redis = Redis.fromEnv();
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "amh:ratelimit"
  });
  return limiter;
}

export async function enforceRateLimit(identifier: string) {
  const instance = getLimiter();
  if (!instance) return fallbackLimit(identifier);
  try {
    const result = await instance.limit(identifier);
    return { success: result.success, unavailable: false, remaining: result.remaining, reset: result.reset };
  } catch {
    return fallbackLimit(identifier);
  }
}

function fallbackLimit(identifier: string) {
  const now = Date.now();
  const existing = fallbackWindows.get(identifier);
  const window = !existing || existing.reset <= now
    ? { count: 0, reset: now + FALLBACK_WINDOW_MS }
    : existing;
  window.count += 1;
  fallbackWindows.set(identifier, window);

  if (fallbackWindows.size > 5_000) {
    for (const [key, value] of fallbackWindows) {
      if (value.reset <= now) fallbackWindows.delete(key);
    }
  }

  return {
    success: window.count <= FALLBACK_LIMIT,
    unavailable: true,
    remaining: Math.max(0, FALLBACK_LIMIT - window.count),
    reset: window.reset
  };
}
