import { AppShell } from "@/components/app-shell";
import { NotificationsClient } from "@/components/workspace-clients";
export const dynamic = "force-dynamic";
export default function NotificationsPage() {
  return <AppShell><NotificationsClient /></AppShell>;
}
