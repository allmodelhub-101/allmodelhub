import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/chat";
  return <main className="auth-page"><section className="glass auth-card"><Brand/><h1>Welcome to <span className="gradient-text">All Model Hub.</span></h1><p className="muted" style={{lineHeight:1.65}}>One account for leading text, image, video and audio AI. Verified accounts can qualify for 10 non-transferable welcome credits.</p><LoginForm nextPath={nextPath}/></section></main>;
}
