import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/simple-forms";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();

  return <AppShell><div className="workspace-page settings-page settings-redesign-page">
    <header className="settings-hero">
      <div className="settings-hero-copy">
        <span className="settings-hero-icon"><SlidersHorizontal weight="bold" aria-hidden="true" /></span>
        <div><span className="kicker">Preferences &amp; safety</span><h1>Settings</h1><p>Control language, appearance, privacy, bandwidth, and personal spending protections.</p></div>
      </div>
      <div className="settings-hero-art" aria-hidden="true"><strong>Your AI space.<br />Your rules.</strong><i /><i /><i /></div>
    </header>
    <SettingsClient initial={profile || {}} />
  </div></AppShell>;
}


