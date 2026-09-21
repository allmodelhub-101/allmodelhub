import { Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { SupportClient } from "@/components/simple-forms";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><div className="workspace-page support-page support-redesign-page">
    <header className="support-hero">
      <div className="support-hero-copy"><span className="support-hero-icon"><Lifebuoy weight="fill" aria-hidden="true" /></span><div><span className="kicker">Help center</span><h1>Support</h1><p>Get help with payments, generations, your account, or a technical problem.</p></div></div>
      <div className="support-hero-art" aria-hidden="true"><strong>We&apos;re here to help.</strong><span>Real people. Faster answers.<br />A more creative you.</span><i /><i /><i /></div>
    </header>
    <SupportClient />
  </div></AppShell>;
}


