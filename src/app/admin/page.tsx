import { AdminOverview } from "@/components/admin-overview";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ count: users }, { count: generations }, { count: failed }, { count: models }, { count: pending }, { data: payments }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("generation_jobs").select("id", { count: "exact", head: true }),
    admin.from("generation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("models").select("id", { count: "exact", head: true }).eq("active", true),
    admin.from("manual_payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("manual_payments").select("amount_pkr,status").eq("status", "approved")
  ]);
  const revenue = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount_pkr ?? 0), 0);
  return <main className="admin-page"><AdminOverview metrics={{ users: users ?? 0, generations: generations ?? 0, failed: failed ?? 0, models: models ?? 0, pending: pending ?? 0, revenue }} /></main>;
}
