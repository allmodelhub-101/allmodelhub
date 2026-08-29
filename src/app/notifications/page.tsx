import { AppShell } from "@/components/app-shell";
import { NotificationsClient } from "@/components/workspace-clients";
export const dynamic = "force-dynamic";
export default function NotificationsPage() {
  return <AppShell><div className="page-head"><div><div className="kicker">Notifications</div><h1 className="page-title">Updates that matter.</h1><p className="muted">Payments, wallet activity, generation results, support and security notices.</p></div></div><NotificationsClient /></AppShell>;
}
