import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "owner"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const { data: payment } = await admin.from("manual_payments").select("user_id,public_id,credits").eq("id", id).maybeSingle();
  const { data: txId, error } = await admin.rpc("approve_manual_payment", { p_payment_id: id, p_reviewer_id: user.id, p_review_note: String(body.note || "").slice(0, 500) || null });
  if (error) { logServerError("admin-payment-approve", error, { actorId: user.id, paymentId: id }); return NextResponse.json({ error: "Could not approve payment." }, { status: 500 }); }
  if (payment) await notifyUser(payment.user_id, { type: "payment", title: "Wallet credited", body: `${payment.public_id} was approved. ${Number(payment.credits).toFixed(0)} Credits were added to your wallet.`, href: "/wallet" });
  return NextResponse.json({ ok: true, transactionId: txId });
}
