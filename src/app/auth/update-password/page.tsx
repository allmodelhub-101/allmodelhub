import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import {UpdatePasswordForm} from "@/components/update-password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import "../login/auth-premium.css";
export default function UpdatePasswordPage(){return <main className="auth-portal"><div className="auth-aurora one"/><div className="auth-aurora two"/><div className="auth-grid"/><nav className="auth-nav"><Link href="/" className="auth-brand"><Image className="brand-logo" src={BRAND.logoPath} alt="" width={48} height={48} priority/><b>{BRAND.name}</b></Link><div className="auth-nav-actions"><ThemeToggle/><Link href="/support">Need help?</Link></div></nav><section className="auth-stage auth-recovery-stage"><aside className="auth-story"><span className="auth-kicker">Account recovery</span><h2>Back to<br/><em>creating.</em></h2><p>Set a new password, then return to your Models Suite workspace.</p></aside><UpdatePasswordForm/></section><footer className="auth-page-foot"><span>© 2026 Models Suite</span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer></main>}

