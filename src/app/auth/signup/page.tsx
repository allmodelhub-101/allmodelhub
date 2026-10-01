import { AuthPage } from "@/components/auth-page";
import { safeAuthenticatedPath } from "@/lib/security/request";
import "../login/auth-premium.css";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeAuthenticatedPath(params.next);

  return <AuthPage mode="signup" nextPath={nextPath} />;
}
