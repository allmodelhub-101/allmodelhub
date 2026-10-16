import { WorkspaceFrame } from "@/components/workspace-frame";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkspaceTopbar } from "@/components/workspace-topbar";
import { requireUser } from "@/lib/auth";
import { getWallet } from "@/lib/wallet";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { WorkspaceNetworkStatus } from "@/components/workspace-network-status";


export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const wallet = await getWallet(user.id).catch(() => ({ available: 0 }));
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("low_bandwidth,role,display_name").eq("id", user.id).single();
  const isAdmin = profile && ["admin", "owner"].includes(profile.role);

  return <WorkspaceFrame lowBandwidth={Boolean(profile?.low_bandwidth)} sidebar={<AppSidebar balance={Number(wallet.available)} displayName={profile?.display_name} email={user.email} isAdmin={Boolean(isAdmin)} />} topbar={<WorkspaceTopbar balance={Number(wallet.available)} identity={profile?.display_name || user.email || "Member"} />} auxiliary={<><WorkspaceOnboarding /><WorkspaceNetworkStatus /></>}>
    {children}
  </WorkspaceFrame>;
}
