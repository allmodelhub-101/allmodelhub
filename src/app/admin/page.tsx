import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminClient } from "@/components/admin-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  const admin = createAdminClient();

  const [paymentsResult, modelsResult, txResult, jobsResult, messagesResult, profilesResult, walletsResult, routesResult, ticketsResult, settingsResult] = await Promise.all([
    admin.from("manual_payments").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("models").select("*").order("modality").order("tier").order("display_name"),
    admin.from("wallet_transactions").select("amount,type").order("created_at", { ascending: false }).limit(5000),
    admin.from("generation_jobs").select("id,public_id,user_id,modality,model_id,provider_key,status,charged_credits,internal_cost_pkr,error_message,created_at").order("created_at", { ascending: false }).limit(250),
    admin.from("messages").select("credits_charged,internal_cost_pkr").eq("role", "assistant").order("created_at", { ascending: false }).limit(10000),
    admin.from("profiles").select("id,email,display_name,role,created_at,welcome_granted_at").order("created_at", { ascending: false }).limit(500),
    admin.from("wallets").select("user_id,purchased_balance,promo_balance,reserved_balance"),
    admin.from("provider_models").select("*").order("model_id").order("priority"),
    admin.from("support_tickets").select("id,public_id,user_id,category,subject,status,priority,created_at,updated_at").order("updated_at", { ascending: false }).limit(250),
    admin.from("system_settings").select("key,value").in("key", ["internal_usd_pkr", "min_topup_pkr", "welcome_credits"])
  ]);

  const profiles = profilesResult.data ?? [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const walletMap = new Map((walletsResult.data ?? []).map((wallet) => [wallet.user_id, wallet]));

  const payments = await Promise.all((paymentsResult.data ?? []).map(async (payment) => {
    let proofUrl: string | undefined;
    if (payment.proof_path) {
      const { data } = await admin.storage.from("payment-proofs").createSignedUrl(payment.proof_path, 600);
      proofUrl = data?.signedUrl;
    }
    return { ...payment, email: profileMap.get(payment.user_id)?.email, proofUrl };
  }));

  const users = profiles.map((profile) => ({ ...profile, wallet: walletMap.get(profile.id) ?? null }));
  const jobs = (jobsResult.data ?? []).map((job) => ({ ...job, email: profileMap.get(job.user_id)?.email ?? null }));
  const tickets = (ticketsResult.data ?? []).map((ticket) => ({ ...ticket, email: profileMap.get(ticket.user_id)?.email ?? null }));
  const models = modelsResult.data ?? [];
  const routes = routesResult.data ?? [];
  const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, Number(row.value)]));
  const txs = txResult.data ?? [];
  const messages = messagesResult.data ?? [];

  const topups = txs.filter((tx) => tx.type === "credit_purchase").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const generationRevenue = txs.filter((tx) => tx.type === "generation_capture").reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const textCost = messages.reduce((sum, message) => sum + Number(message.internal_cost_pkr ?? 0), 0);
  const mediaCost = jobs.filter((job) => job.status === "completed").reduce((sum, job) => sum + Number(job.internal_cost_pkr ?? 0), 0);
  const internalCost = textCost + mediaCost;
  const grossProfit = generationRevenue - internalCost;
  const grossMargin = generationRevenue > 0 ? (grossProfit / generationRevenue) * 100 : 0;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const pendingPayments = payments.filter((payment) => ["pending", "under_review", "request_new_proof"].includes(payment.status)).length;
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;

  return (
    <AppShell>
      <div style={{ marginBottom: 20 }}>
        <div className="kicker">Control center</div>
        <h1 className="page-title">All Model Hub Admin</h1>
        <p className="muted">Payments, users, models, provider routes, generations, support, and profitability in one place.</p>
      </div>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card stat-card"><span>Purchased credits</span><strong>{topups.toFixed(0)}</strong></div>
        <div className="card stat-card"><span>Generation revenue</span><strong>{generationRevenue.toFixed(2)}</strong></div>
        <div className="card stat-card"><span>Internal API cost</span><strong>PKR {internalCost.toFixed(2)}</strong></div>
        <div className="card stat-card"><span>Gross profit</span><strong>PKR {grossProfit.toFixed(2)}</strong><small>{grossMargin.toFixed(1)}% margin</small></div>
        <div className="card stat-card"><span>Pending payments</span><strong>{pendingPayments}</strong></div>
        <div className="card stat-card"><span>Open support</span><strong>{openTickets}</strong></div>
        <div className="card stat-card"><span>Completed media</span><strong>{completed}</strong></div>
        <div className="card stat-card"><span>Failed media</span><strong>{failed}</strong></div>
      </div>
      <AdminClient payments={payments} models={models} users={users} routes={routes} jobs={jobs} tickets={tickets} settings={settings} />
    </AppShell>
  );
}
