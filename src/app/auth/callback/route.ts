import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/user-profile";
import { grantWelcomeCredits } from "@/lib/wallet";
import { looksDisposable } from "@/lib/disposable-email";
import { getWelcomeCredits } from "@/lib/system-settings";
import { safeAuthenticatedPath } from "@/lib/security/request";

function loginErrorUrl(origin: string, code: string, next: string) {
  const login = new URL("/auth/login", origin);
  login.searchParams.set("error", code);
  login.searchParams.set("next", next);
  return login;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthenticatedPath(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(loginErrorUrl(url.origin, "missing_code", next));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(loginErrorUrl(url.origin, "authentication_failed", next));
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await ensureProfile(data.user);
    if (data.user.email_confirmed_at && !looksDisposable(data.user.email)) {
      const welcomeCredits = await getWelcomeCredits();
      if (welcomeCredits > 0) await grantWelcomeCredits(data.user.id, welcomeCredits).catch(() => undefined);
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
