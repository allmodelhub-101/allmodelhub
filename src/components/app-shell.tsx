import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { getWallet } from "@/lib/wallet";
import { createAdminClient } from "@/lib/supabase/admin";


export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const wallet = await getWallet(user.id).catch(() => ({ available: 0 }));
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("low_bandwidth,role,display_name").eq("id", user.id).single();
  const isAdmin = profile && ["admin", "owner"].includes(profile.role);

  return <div className={`app-shell ${profile?.low_bandwidth ? "low-bandwidth" : ""}`}>
    <AppSidebar balance={Number(wallet.available)} displayName={profile?.display_name} email={user.email} isAdmin={Boolean(isAdmin)} />
    <main className="app-main">
      <header className="app-topbar"><Link href="/wallet" className="wallet-chip"><span className="status-dot" />{Number(wallet.available).toFixed(2)} Credits</Link><div className="topbar-user"><span className="muted small">{profile?.display_name || user.email}</span><ThemeToggle /></div></header>
      <div className="app-content">{children}</div>
    </main>
  </div>;
}
