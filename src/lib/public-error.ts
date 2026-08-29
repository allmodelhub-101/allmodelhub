export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[${scope}]`, { error, ...context });
}

export function publicError(fallback: string) {
  return { error: fallback };
}
