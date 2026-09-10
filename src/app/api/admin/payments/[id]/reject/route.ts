import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin/check-admin";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { id } = await context.params;
  const { data: payment } = await admin.from("manual_payments").select("user_id,public_id,status").eq("id", id).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status === "approved") return NextResponse.json({ error: "Approved payments cannot be rejected." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const reviewNote = String(body.note || "Payment could not be verified").slice(0, 500);
  const { data: updated, error } = await admin.from("manual_payments").update({
    status: "rejected",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_note: reviewNote,
    updated_at: new Date().toISOString()
  }).eq("id", id).neq("status", "approved").select("id").maybeSingle();
  if (error) {
    logServerError("admin-payment-reject", error, { actorId: user.id, paymentId: id });
    return NextResponse.json({ error: "Could not reject payment." }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Payment state changed. Refresh and try again." }, { status: 409 });

  await admin.from("audit_logs").insert({ actor_user_id: user.id, action: "payment.rejected", entity_type: "manual_payment", entity_id: id, metadata: { review_note: reviewNote } });
  await notifyUser(payment.user_id, { type: "payment", title: "Payment needs attention", body: `${payment.public_id} could not be verified. Review your proof and contact support if needed.`, href: "/wallet" });
  return NextResponse.json({ ok: true });
}
