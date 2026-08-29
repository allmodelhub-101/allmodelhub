import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  internalUsdPkr: z.number().min(1).max(10_000).optional(),
  minTopupPkr: z.number().min(1).max(10_000_000).optional(),
  welcomeCredits: z.number().min(0).max(10_000).optional()
});

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("system_settings").select("key,value").in("key", ["internal_usd_pkr", "min_topup_pkr", "welcome_credits"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: Object.fromEntries((data ?? []).map((row) => [row.key, row.value])) });
}

export async function PATCH(request: Request) {
  const actor = await requireAdmin();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid platform settings", details: parsed.error.flatten() }, { status: 400 });
  const admin = createAdminClient();
  const mapping: Record<string, number | undefined> = {
    internal_usd_pkr: parsed.data.internalUsdPkr,
    min_topup_pkr: parsed.data.minTopupPkr,
    welcome_credits: parsed.data.welcomeCredits
  };
  const rows = Object.entries(mapping).filter(([, value]) => value !== undefined).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  if (!rows.length) return NextResponse.json({ error: "No settings supplied" }, { status: 400 });
  const { error } = await admin.from("system_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "platform_settings.updated", entity_type: "system_settings", metadata: parsed.data });
  return NextResponse.json({ ok: true });
}
