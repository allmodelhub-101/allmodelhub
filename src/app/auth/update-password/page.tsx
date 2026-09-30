import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import {UpdatePasswordForm} from "@/components/update-password-form";
import "../login/auth-premium.css";
export default function UpdatePasswordPage(){return <main className="auth-portal"><div className="auth-aurora one"/><div className="auth-aurora two"/><div className="auth-grid"/><nav className="auth-nav"><Link href="/" className="auth-brand"><Image className="brand-logo" src={BRAND.logoPath} alt="" width={48} height={48} priority/><b>{BRAND.name}</b></Link></nav><section className="auth-stage auth-recovery-stage"><aside className="auth-story"><span className="auth-kicker">Protected account recovery</span><h2>Back to<br/><em>creating.</em></h2><p>Your recovery session is encrypted and time-limited.</p></aside><UpdatePasswordForm/></section></main>}

