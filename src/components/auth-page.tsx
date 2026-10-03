import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

type EntryMode = "login" | "signup";

export function AuthPage({ mode, nextPath, authError }: { mode: EntryMode; nextPath: string; authError?: string }) {
  return <main className="auth-portal">
    <div className="auth-aurora one" />
    <div className="auth-aurora two" />
    <div className="auth-grid" />
    <nav className="auth-nav">
      <Link href="/" className="auth-brand"><Image className="brand-logo" src={BRAND.logoPath} alt="" width={48} height={48} priority /><b>{BRAND.name}</b></Link>
      <div className="auth-nav-actions"><ThemeToggle /><Link href="/support">Need help?</Link></div>
    </nav>
    <section className="auth-stage">
      <aside className="auth-story">
        <span className="auth-kicker">One intelligent workspace</span>
        <h2>Everything you create.<br /><em>One powerful place.</em></h2>
        <p>Chat, images, video, audio and projects in one intelligent workspace.</p>
        <div className="auth-model-orbit" aria-hidden="true">
          <span className="auth-capability chat">Chat</span><span className="auth-capability image">Image</span><span className="auth-capability video">Video</span><span className="auth-capability audio">Audio</span>
          <i className="auth-orbit auth-orbit-one" /><i className="auth-orbit auth-orbit-two" />
          <b>MS<small>Creative OS</small></b>
        </div>
        <ul><li><i>✓</i>Private creative workspace</li><li><i>✓</i>Transparent PKR credits</li></ul>
      </aside>
      <LoginForm nextPath={nextPath} initialMode={mode} authError={authError} />
    </section>
    <footer className="auth-page-foot"><span>© 2026 Models Suite</span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>
  </main>;
}
