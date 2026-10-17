import {SettingsWorkspace} from "@/components/settings-workspace";
import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/simple-forms";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();

  return <AppShell><SettingsWorkspace><SettingsClient initial={profile || {}} /></SettingsWorkspace></AppShell>;
}


