export function createPublicId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${suffix}`;
}

export function createIdempotencyKey(scope: string, userId: string) {
  return `${scope}:${userId}:${crypto.randomUUID()}`;
}
