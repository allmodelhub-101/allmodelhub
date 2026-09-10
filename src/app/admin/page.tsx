import { AdminWorkspace } from "@/components/admin-workspace";
import type { AdminTab } from "@/components/admin-client";

const tabs: AdminTab[] = ["payments", "models", "providers", "users", "jobs", "support", "settings"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const initialTab = tabs.includes(requested as AdminTab) ? requested as AdminTab : "payments";
  return <AdminWorkspace initialTab={initialTab} />;
}
