import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

type EntryMode = "login" | "signup";

const story = {
  login: {
    kicker: "Secure member access",
    heading: <>Welcome back<br /><em>to your work.</em></>,
    description: "Pick up conversations and creations across the leading text, image, video, and audio models in your private workspace.",
  },
  signup: {
    kicker: "One prompt. Every leading model.",
    heading: <>Your ideas,<br /><em>amplified.</em></>,
    description: "Create one secure account for your text, image, video, and audio work in Models Suite.",
  },
} as const;

export function AuthPage({ mode, nextPath, authError }: { mode: EntryMode; nextPath: string; authError?: string }) {
  const content = story[mode];

  return <main className="auth-portal">
    <div className="auth-aurora one" />
    <div className="auth-aurora two" />
    <div className="auth-grid" />
    <nav className="auth-nav">
      <Link href="/" className="auth-brand"><Image className="brand-logo" src={BRAND.logoPath} alt="" width={48} height={48} priority /><b>{BRAND.name}</b></Link>
      <div className="auth-nav-actions"><ThemeToggle /><Link href="/support">Need help?</Link></div>
    </nav>
    <section className="auth-stage">
      <aside className={`auth-story auth-story-${mode}`}>
        <span className="auth-kicker">{content.kicker}</span>
        <h2>{content.heading}</h2>
        <p>{content.description}</p>
        <div className="auth-model-orbit" aria-hidden="true"><span>GPT</span><span>Claude</span><span>Gemini</span><span>Flux</span><b>MS<small>Creative OS</small></b></div>
        <ul><li><i>✓</i>One secure account</li><li><i>✓</i>Transparent PKR credits</li><li><i>✓</i>Your work stays yours</li></ul>
      </aside>
      <LoginForm nextPath={nextPath} initialMode={mode} authError={authError} />
    </section>
    <footer className="auth-page-foot"><span>© 2026 Models Suite</span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>
  </main>;
}
