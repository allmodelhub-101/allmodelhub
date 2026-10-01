import { AuthPage } from "@/components/auth-page";
import "../login/auth-premium.css";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/chat";

  return <AuthPage mode="signup" nextPath={nextPath} />;
}
