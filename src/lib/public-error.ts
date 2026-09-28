import "server-only";

const sensitiveKey = /(authorization|cookie|secret|token|password|key|payload|body|url)/i;

function safeValue(key: string, value: unknown) {
  if (sensitiveKey.test(key)) return "[redacted]";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value).slice(0, 160);
  return undefined;
}

export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const safeContext = Object.fromEntries(
    Object.entries(context ?? {}).map(([key, value]) => [key, safeValue(key, value)]).filter((entry) => entry[1] !== undefined)
  );
  const safeError = error instanceof Error
    ? { name: error.name.slice(0, 80), message: error.message.replace(/https?:\/\/\S+/gi, "[url]").slice(0, 240) }
    : { name: "UnknownError" };
  console.error(`[${scope}]`, { error: safeError, context: safeContext });
}

export function publicError(fallback: string) {
  return { error: fallback };
}
