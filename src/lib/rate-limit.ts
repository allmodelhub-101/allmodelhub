import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export type RateLimitPolicy = "auth" | "chat" | "prompt" | "image" | "video" | "preflight" | "audio" | "tts" | "files" | "payments" | "support" | "callback" | "admin" | "standard";

const policies: Record<RateLimitPolicy, { limit: number; window: `${number} ${"s" | "m" | "h"}`; fallbackWindowMs: number }> = {
  auth: { limit: 5, window: "10 m", fallbackWindowMs: 10 * 60_000 },
  chat: { limit: 20, window: "1 m", fallbackWindowMs: 60_000 },
  prompt: { limit: 10, window: "1 m", fallbackWindowMs: 60_000 },
  image: { limit: 6, window: "1 m", fallbackWindowMs: 60_000 },
  video: { limit: 3, window: "5 m", fallbackWindowMs: 5 * 60_000 },
  preflight: { limit: 30, window: "1 m", fallbackWindowMs: 60_000 },
  audio: { limit: 6, window: "1 m", fallbackWindowMs: 60_000 },
  tts: { limit: 10, window: "1 m", fallbackWindowMs: 60_000 },
  files: { limit: 6, window: "5 m", fallbackWindowMs: 5 * 60_000 },
  payments: { limit: 3, window: "1 h", fallbackWindowMs: 60 * 60_000 },
  support: { limit: 5, window: "1 h", fallbackWindowMs: 60 * 60_000 },
  callback: { limit: 60, window: "1 m", fallbackWindowMs: 60_000 },
  admin: { limit: 30, window: "1 m", fallbackWindowMs: 60_000 },
  standard: { limit: 30, window: "1 m", fallbackWindowMs: 60_000 }
};

const limiters = new Map<RateLimitPolicy, Ratelimit>();
const fallbackWindows = new Map<string, { count: number; reset: number }>();

function getLimiter(policy: RateLimitPolicy) {
  const cached = limiters.get(policy);
  if (cached) return cached;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = Redis.fromEnv();
  const configuration = policies[policy];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(configuration.limit, configuration.window),
    analytics: true,
    prefix: `amh:ratelimit:${policy}`
  });
  limiters.set(policy, limiter);
  return limiter;
}

export async function enforceRateLimit(identifier: string, policy: RateLimitPolicy = "standard") {
  const instance = getLimiter(policy);
  if (!instance) return unavailableOrDevelopmentFallback(identifier, policy);
  try {
    const result = await instance.limit(identifier);
    return { success: result.success, unavailable: false, remaining: result.remaining, reset: result.reset };
  } catch {
    return unavailableOrDevelopmentFallback(identifier, policy);
  }
}

function unavailableOrDevelopmentFallback(identifier: string, policy: RateLimitPolicy) {
  if (process.env.NODE_ENV === "production") {
    return { success: false, unavailable: true, remaining: 0, reset: Date.now() + 30_000 };
  }
  return fallbackLimit(identifier, policy);
}

function fallbackLimit(identifier: string, policy: RateLimitPolicy) {
  const now = Date.now();
  const configuration = policies[policy];
  const key = `${policy}:${identifier}`;
  const existing = fallbackWindows.get(key);
  const window = !existing || existing.reset <= now
    ? { count: 0, reset: now + configuration.fallbackWindowMs }
    : existing;
  window.count += 1;
  fallbackWindows.set(key, window);

  if (fallbackWindows.size > 5_000) {
    for (const [key, value] of fallbackWindows) {
      if (value.reset <= now) fallbackWindows.delete(key);
    }
  }

  return {
    success: window.count <= configuration.limit,
    unavailable: false,
    remaining: Math.max(0, configuration.limit - window.count),
    reset: window.reset
  };
}

