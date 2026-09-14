import { AdminClient, type AdminTab } from "@/components/admin-client";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

export async function AdminWorkspace({ initialTab }: { initialTab: AdminTab }) {
  const admin = createAdminClient();
  const economicsCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [paymentsResult, modelsResult, profilesResult, walletsResult, routesResult, jobsResult, ticketsResult, settingsResult, messageEconomicsResult, mediaEconomicsResult, features] = await Promise.all([
    admin.from("manual_payments").select("id,public_id,user_id,method,amount_pkr,credits,bonus_percent,bonus_credits,status,transaction_reference,proof_path,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("models").select("id,display_name,tier,modality,markup,active,featured,auto_eligible,provider_family,upstream_model").order("modality").order("tier").order("display_name"),
    admin.from("profiles").select("id,email,display_name,role,created_at,welcome_granted_at").order("created_at", { ascending: false }).limit(500),
    admin.from("wallets").select("user_id,purchased_balance,promo_balance,reserved_balance"),
    admin.from("provider_models").select("id,model_id,provider_key,upstream_model,priority,active").order("model_id").order("priority"),
    admin.from("generation_jobs").select("id,public_id,user_id,modality,model_id,provider_key,status,charged_credits,error_message,created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("support_tickets").select("id,public_id,user_id,category,subject,status,priority,updated_at").order("updated_at", { ascending: false }).limit(100),
    admin.from("system_settings").select("key,value").in("key", ["internal_usd_pkr", "min_topup_pkr", "welcome_credits"]),
    admin.from("messages").select("credits_charged,internal_cost_pkr").eq("role", "assistant").gte("created_at", economicsCutoff),
    admin.from("generation_jobs").select("charged_credits,internal_cost_pkr").eq("status", "completed").gte("completed_at", economicsCutoff),
    getFeatureFlags()
  ]);

  const failed = [paymentsResult, modelsResult, profilesResult, walletsResult, routesResult, jobsResult, ticketsResult, settingsResult, messageEconomicsResult, mediaEconomicsResult].find((result) => result.error);
  if (failed?.error) throw new Error(`Could not load admin workspace: ${failed.error.message}`);

  const profiles = profilesResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const walletById = new Map((walletsResult.data ?? []).map((wallet) => [wallet.user_id, wallet]));
  const proofPaths = (paymentsResult.data ?? []).map((payment) => payment.proof_path).filter((path): path is string => Boolean(path));
  const proofByPath = new Map<string, string>();
  if (proofPaths.length) {
    const { data } = await admin.storage.from("payment-proofs").createSignedUrls(proofPaths, 60 * 60);
    for (const item of data ?? []) if (item.path && item.signedUrl) proofByPath.set(item.path, item.signedUrl);
  }

  return <AdminClient
    initialTab={initialTab}
    payments={(paymentsResult.data ?? []).map((payment) => ({ ...payment, amount_pkr: Number(payment.amount_pkr), credits: Number(payment.credits), bonus_percent: Number(payment.bonus_percent || 0), bonus_credits: Number(payment.bonus_credits || 0), email: profileById.get(payment.user_id)?.email, proofUrl: payment.proof_path ? proofByPath.get(payment.proof_path) : undefined }))}
    models={(modelsResult.data ?? []).map((model) => ({ ...model, markup: Number(model.markup) }))}
    users={profiles.map((profile) => { const wallet = walletById.get(profile.id); return { ...profile, wallet: wallet ? { purchased_balance: Number(wallet.purchased_balance), promo_balance: Number(wallet.promo_balance), reserved_balance: Number(wallet.reserved_balance) } : null }; })}
    routes={(routesResult.data ?? []).map((route) => ({ ...route, provider_key: route.provider_key as "apimodels" | "haimaker" }))}
    jobs={(jobsResult.data ?? []).map((job) => ({ ...job, charged_credits: Number(job.charged_credits), email: profileById.get(job.user_id)?.email }))}
    tickets={(ticketsResult.data ?? []).map((ticket) => ({ ...ticket, email: profileById.get(ticket.user_id)?.email }))}
    settings={Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, Number(row.value)]))}
    features={features}
    profitSummary={{
      chatRevenue: (messageEconomicsResult.data ?? []).reduce((sum, row) => sum + Number(row.credits_charged || 0), 0),
      chatCost: (messageEconomicsResult.data ?? []).reduce((sum, row) => sum + Number(row.internal_cost_pkr || 0), 0),
      mediaRevenue: (mediaEconomicsResult.data ?? []).reduce((sum, row) => sum + Number(row.charged_credits || 0), 0),
      mediaCost: (mediaEconomicsResult.data ?? []).reduce((sum, row) => sum + Number(row.internal_cost_pkr || 0), 0)
    }}
  />;
}


