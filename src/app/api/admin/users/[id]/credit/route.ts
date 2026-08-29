import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { logServerError } from "@/lib/public-error";

const schema = z.object({ amount: z.number().positive().max(1_000_000), bucket: z.enum(["purchased", "promo"]).default("promo"), note: z.string().max(500).min(3) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(); const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid credit adjustment" }, { status: 400 });
  const admin = createAdminClient();
  const key = `admin-adjust:${actor.id}:${id}:${crypto.randomUUID()}`;
  const { data: tx, error } = await admin.rpc("credit_wallet", { p_user_id: id, p_amount: parsed.data.amount, p_bucket: parsed.data.bucket, p_type: "admin_adjustment", p_idempotency_key: key, p_reference_id: `admin:${actor.id}`, p_metadata: { note: parsed.data.note } });
  if (error) { logServerError("admin-wallet-credit", error, { actorId: actor.id, userId: id }); return NextResponse.json({ error: "Could not credit wallet." }, { status: 500 }); }
  await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "wallet.admin_credit", entity_type: "user", entity_id: id, metadata: parsed.data });
  await notifyUser(id, { type: "wallet", title: "Wallet adjustment", body: `${parsed.data.amount.toFixed(2)} ${parsed.data.bucket} Credits were added by support.`, href: "/usage" });
  return NextResponse.json({ ok: true, transactionId: tx });
}
