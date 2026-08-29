import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { getWallet } from "@/lib/wallet";
import { createAdminClient } from "@/lib/supabase/admin";

const groups = [
  ["Create", [["New Chat", "/chat"], ["Images", "/images"], ["Video", "/video"], ["Audio", "/audio"]]],
  ["Workspace", [["History", "/history"], ["Projects", "/projects"], ["Files", "/files"], ["Templates", "/templates"], ["Models", "/models"], ["Model Battle", "/battle"]]],
  ["Account", [["Wallet", "/wallet"], ["Usage & Receipts", "/usage"], ["Notifications", "/notifications"], ["Settings", "/settings"], ["Help", "/support"]]]
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const wallet = await getWallet(user.id).catch(() => ({ available: 0 }));
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("low_bandwidth,role,display_name").eq("id", user.id).single();
  const isAdmin = profile && ["admin", "owner"].includes(profile.role);

  return <div className={`app-shell ${profile?.low_bandwidth ? "low-bandwidth" : ""}`}>
    <aside className="app-sidebar">
      <div className="sidebar-brand"><Brand /></div>
      {groups.map(([label, items]) => <div key={label}>
        <div className="sidebar-section">{label}</div>
        <div className="sidebar-nav">{items.map(([name, href]) => <Link className="sidebar-link" href={href} key={href}>{name}</Link>)}</div>
      </div>)}
      <div className="sidebar-bottom">
        {isAdmin && <div className="sidebar-nav"><Link className="sidebar-link" href="/admin">Admin Control Center</Link></div>}
        <form action="/auth/logout" method="post"><button className="sidebar-link sidebar-button" type="submit">Sign out</button></form>
      </div>
    </aside>

    <main className="app-main">
      <header className="app-topbar">
        <Link href="/wallet" className="wallet-chip"><span className="status-dot" />{Number(wallet.available).toFixed(2)} Credits</Link>
        <div className="topbar-user"><span className="muted small">{profile?.display_name || user.email}</span><ThemeToggle /></div>
      </header>
      <div className="app-content">{children}</div>
      <nav className="mobile-nav"><Link href="/chat">Chat</Link><Link href="/images">Images</Link><Link href="/video">Video</Link><Link href="/wallet">Wallet</Link><Link href="/settings">More</Link></nav>
    </main>
  </div>;
}
