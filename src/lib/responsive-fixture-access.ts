// Test-only presentation boundary. Never use this predicate to authorize a user.
export function localResponsiveFixtureAllowed({ mode, flag, vercel, host }: {
  mode?: string; flag?: string; vercel?: string; host: string;
}) {
  return mode === "development" && flag === "1" && vercel === undefined &&
    /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(host);
}
