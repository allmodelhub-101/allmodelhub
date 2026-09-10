import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAdmin } from "@/lib/admin/check-admin";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";

const bodySchema = z.object({
  note: z.string().trim().max(500).optional().default("")
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

  const { id } = await context.params;
  const { data: payment, error: paymentError } = await admin
    .from("manual_payments")
    .select("id,user_id,public_id,credits,status")
    .eq("id", id)
    .maybeSingle();

  if (paymentError) {
    logServerError("admin-payment-lookup", paymentError, { actorId: user.id, paymentId: id });
    return NextResponse.json({ error: "Could not load payment." }, { status: 500 });
  }
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const wasApproved = payment.status === "approved";
  const { data: transactionId, error: approvalError } = await admin.rpc("approve_manual_payment", {
    p_payment_id: id,
    p_reviewer_id: user.id,
    p_review_note: parsed.data.note || null
  });

  if (approvalError) {
    logServerError("admin-payment-approve", approvalError, { actorId: user.id, paymentId: id });
    const invalidState = /cannot be approved|missing ledger/i.test(approvalError.message);
    return NextResponse.json(
      { error: invalidState ? "This payment cannot be approved in its current state." : "Could not approve payment." },
      { status: invalidState ? 409 : 500 }
    );
  }

  if (!wasApproved) {
    await notifyUser(payment.user_id, {
      type: "payment",
      title: "Payment approved",
      body: `${payment.public_id} was approved. ${Number(payment.credits).toFixed(2)} Credits were added to your wallet.`,
      href: "/wallet"
    });
  }

  return NextResponse.json({ ok: true, transactionId });
}
