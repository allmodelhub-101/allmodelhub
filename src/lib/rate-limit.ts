import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let limiter: Ratelimit | null | undefined;

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
  if (!instance) return { success: false, unavailable: true, remaining: 0 };
  try {
    const result = await instance.limit(identifier);
    return { success: result.success, unavailable: false, remaining: result.remaining, reset: result.reset };
  } catch {
    return { success: false, unavailable: true, remaining: 0 };
  }
}
