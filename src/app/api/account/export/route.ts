import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    admin.from("generation_jobs").select("*").eq("user_id", userId).order("created_at"),
    admin.from("manual_payments").select("id,public_id,method,amount_pkr,credits,status,transaction_reference,created_at,reviewed_at").eq("user_id", userId),
    admin.from("support_tickets").select("*").eq("user_id", userId)
  ]);
  const payload = { exportedAt: new Date().toISOString(), account: { id: userId, email: data.user.email, createdAt: data.user.created_at }, profile: profile.data, wallet: wallet.data, transactions: transactions.data, conversations: conversations.data, messages: messages.data, projects: projects.data, files: files.data, generations: jobs.data, payments: payments.data, supportTickets: tickets.data };
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="all-model-hub-export-${new Date().toISOString().slice(0, 10)}.json"` } });
}
