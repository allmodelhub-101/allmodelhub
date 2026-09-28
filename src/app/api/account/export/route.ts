import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { privateNoStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await enforceRateLimit(`account-export:${data.user.id}`, "support");
  if (limit.unavailable) return NextResponse.json({ error: "Export protection is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many export requests." }, { status: 429 });
  const admin = createAdminClient();
  const userId = data.user.id;
  const [profile, wallet, transactions, conversations, messages, projects, files, jobs, payments, tickets] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at"),
    admin.from("conversations").select("*").eq("user_id", userId).order("created_at"),
    admin.from("messages").select("id,conversation_id,role,content,model_id,credits_charged,created_at").eq("user_id", userId).order("created_at"),
    admin.from("projects").select("*").eq("user_id", userId).order("created_at"),
    admin.from("user_files").select("id,project_id,name,mime_type,size_bytes,extraction_status,created_at").eq("user_id", userId),
    admin.from("generation_jobs").select("id,public_id,project_id,modality,model_id,status,prompt,estimated_credits,reserved_credits,charged_credits,result_urls,error_message,created_at,updated_at,completed_at").eq("user_id", userId).order("created_at"),
    admin.from("manual_payments").select("id,public_id,method,amount_pkr,credits,status,transaction_reference,created_at,reviewed_at").eq("user_id", userId),
    admin.from("support_tickets").select("*").eq("user_id", userId)
  ]);
  const payload = { exportedAt: new Date().toISOString(), account: { id: userId, email: data.user.email, createdAt: data.user.created_at }, profile: profile.data, wallet: wallet.data, transactions: transactions.data, conversations: conversations.data, messages: messages.data, projects: projects.data, files: files.data, generations: jobs.data, payments: payments.data, supportTickets: tickets.data };
  await admin.from("audit_logs").insert({ actor_user_id: userId, action: "account_data.exported", entity_type: "user", entity_id: userId });
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { ...privateNoStoreHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="all-model-hub-export-${new Date().toISOString().slice(0, 10)}.json"` } });
}
