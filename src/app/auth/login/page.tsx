import { AuthPage } from "@/components/auth-page";
import { safeAuthenticatedPath } from "@/lib/security/request";
import "./auth-premium.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = safeAuthenticatedPath(params.next);

  return <AuthPage mode="login" nextPath={nextPath} authError={params.error} />;
}
