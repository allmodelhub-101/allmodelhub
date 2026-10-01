export function safeInternalPath(value: string | null | undefined, fallback = "/chat") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const base = new URL("https://models-suite.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export const DEFAULT_AUTH_DESTINATION = "/chat";

const unsafeAuthenticatedDestinations = [
  "/api",
  "/_next",
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth/logout",
];

export function safeAuthenticatedPath(value: string | null | undefined) {
  const path = safeInternalPath(value, DEFAULT_AUTH_DESTINATION);
  const pathname = path.split(/[?#]/, 1)[0];
  if (unsafeAuthenticatedDestinations.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return DEFAULT_AUTH_DESTINATION;
  }
  return path;
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function isTrustedMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite !== "cross-site";
  const requestOrigin = new URL(request.url).origin;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : requestOrigin;
  return origin === requestOrigin || origin === appOrigin;
}

export const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache"
};
