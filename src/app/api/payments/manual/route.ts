import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicId } from "@/lib/security/ids";
import { getManualPaymentMethods } from "@/lib/payment-config";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications";
import { getMinimumTopupPkr } from "@/lib/system-settings";
import { logServerError } from "@/lib/public-error";
import { calculateTopupBonus, TOPUP_MAX_PKR, TOPUP_MIN_PKR } from "@/lib/topup-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const minimum = Math.max(TOPUP_MIN_PKR, await getMinimumTopupPkr());
  return NextResponse.json({ methods: getManualPaymentMethods(), minimum });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(`manual-payment:${user.id}`);
  if (!limit.success) return NextResponse.json({ error: "Too many payment submissions." }, { status: 429 });

  const form = await request.formData();
  const method = String(form.get("method") || "");
  const amount = Number(form.get("amount") || 0);
  const transactionReference = String(form.get("transactionReference") || "").trim();
  const note = String(form.get("note") || "").trim().slice(0, 500);
  const proof = form.get("proof");

  if (!['easypaisa','meezan'].includes(method)) return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  const minimum = Math.max(TOPUP_MIN_PKR, await getMinimumTopupPkr());
  if (!Number.isInteger(amount) || amount < minimum) return NextResponse.json({ error: `Minimum top-up is PKR ${minimum.toLocaleString()}.` }, { status: 400 });
  if (amount > TOPUP_MAX_PKR) return NextResponse.json({ error: `Maximum top-up is PKR ${TOPUP_MAX_PKR.toLocaleString()}.` }, { status: 400 });
  if (transactionReference.length < 4 || transactionReference.length > 120) return NextResponse.json({ error: "Enter a valid transaction/reference ID." }, { status: 400 });
  if (!(proof instanceof File) || proof.size < 1 || proof.size > 5 * 1024 * 1024 || !allowedTypes.has(proof.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG, WEBP, or PDF proof up to 5 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: duplicate } = await admin.from("manual_payments").select("id").eq("method", method).ilike("transaction_reference", transactionReference).maybeSingle();
  if (duplicate) return NextResponse.json({ error: "This transaction/reference ID has already been submitted." }, { status: 409 });

  const publicId = createPublicId("AMH-PAY");
  const bonus = calculateTopupBonus(amount);
  const ext = proof.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${user.id}/${publicId}/proof.${ext}`;
  const bytes = new Uint8Array(await proof.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("payment-proofs").upload(path, bytes, { contentType: proof.type, upsert: false });
  if (uploadError) { logServerError("manual-payment-proof-upload", uploadError, { userId: user.id }); return NextResponse.json({ error: "Could not store payment proof. Try again." }, { status: 500 }); }

  const { data: payment, error } = await admin.from("manual_payments").insert({
    public_id: publicId,
    user_id: user.id,
    method,
    amount_pkr: amount,
    credits: amount,
    bonus_percent: bonus.percent,
    bonus_credits: bonus.bonusCredits,
    transaction_reference: transactionReference,
    proof_path: path,
    note,
    status: "pending"
  }).select("id,public_id,status,amount_pkr,credits,bonus_percent,bonus_credits,created_at").single();

  if (error) {
    await admin.storage.from("payment-proofs").remove([path]).catch(() => undefined);
    logServerError("manual-payment-create", error, { userId: user.id, method });
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "This transaction/reference ID has already been submitted." : "Could not submit payment. Try again." }, { status: duplicate ? 409 : 500 });
  }

  await notifyUser(user.id, { type: "payment", title: "Payment submitted", body: `${publicId} for PKR ${amount.toLocaleString()} is pending verification.`, href: "/wallet" });
  return NextResponse.json({ payment: { ...payment, total_credits: Number(payment.credits) + Number(payment.bonus_credits) } }, { status: 201 });
}

