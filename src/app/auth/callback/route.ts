import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/user-profile";
import { grantWelcomeCredits } from "@/lib/wallet";
import { looksDisposable } from "@/lib/disposable-email";
import { getWelcomeCredits } from "@/lib/system-settings";
import { safeInternalPath } from "@/lib/security/request";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL(`/auth/login?error=missing_code`, url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth/login?error=authentication_failed", url.origin));
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
