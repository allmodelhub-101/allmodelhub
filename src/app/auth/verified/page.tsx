import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmailVerifiedCard } from "@/components/email-verified-card";
import { EMAIL_VERIFIED_COOKIE } from "@/lib/auth-confirmation";
import { createClient } from "@/lib/supabase/server";
import "../login/auth-premium.css";

export const dynamic = "force-dynamic";

export default async function VerifiedPage() {
  const [cookieStore, supabase] = await Promise.all([cookies(), createClient()]);
  const { data } = await supabase.auth.getUser();
  const confirmationMarker = cookieStore.get(EMAIL_VERIFIED_COOKIE)?.value;

  if (!data.user?.email_confirmed_at || confirmationMarker !== "confirmed") {
    redirect(data.user ? "/chat" : "/auth/login?error=verification_required");
  }

  return <main className="verified-page">
    <div className="auth-aurora one" /><div className="auth-aurora two" /><div className="auth-grid" />
    <EmailVerifiedCard />
  </main>;
}

