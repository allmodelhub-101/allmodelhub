import { NextResponse } from "next/server";
import { provisionAuthenticatedUser } from "@/lib/auth-provision";
import { EMAIL_VERIFIED_COOKIE, parseSignupConfirmationType } from "@/lib/auth-confirmation";
import { createClient } from "@/lib/supabase/server";

function loginError(origin: string, code: string) {
  const destination = new URL("/auth/login", origin);
  destination.searchParams.set("error", code);
  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = parseSignupConfirmationType(url.searchParams.get("type"));

  if (!tokenHash || !type) return loginError(url.origin, "verification_invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user?.email_confirmed_at) {
    const current = await supabase.auth.getUser();
    if (current.data.user?.email_confirmed_at) return NextResponse.redirect(new URL("/chat", url.origin));
    return loginError(url.origin, "verification_invalid");
  }

  try {
    await provisionAuthenticatedUser(data.user);
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return loginError(url.origin, "provisioning_failed");
  }

  const response = NextResponse.redirect(new URL("/auth/verified", url.origin));
  response.cookies.set(EMAIL_VERIFIED_COOKIE, "confirmed", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/verified",
    maxAge: 30,
  });
  return response;
}

