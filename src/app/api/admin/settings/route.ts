import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/public-error";

const schema = z.object({
  internalUsdPkr: z.number().min(1).max(10_000).optional(),
  minTopupPkr: z.number().min(1).max(10_000_000).optional(),
  welcomeCredits: z.number().min(0).max(10_000).optional(),
  features: z.record(z.enum(["audio_studio", "image_studio", "model_battle", "private_chat", "prompt_enhancer", "teams", "video_studio"]), z.boolean()).optional()
});

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("system_settings").select("key,value").in("key", ["internal_usd_pkr", "min_topup_pkr", "welcome_credits"]);
  if (error) { logServerError("admin-settings-read", error); return NextResponse.json({ error: "Could not load platform settings." }, { status: 500 }); }
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
  if (!rows.length && !parsed.data.features) return NextResponse.json({ error: "No settings supplied" }, { status: 400 });
  if (rows.length) {
    const { error } = await admin.from("system_settings").upsert(rows, { onConflict: "key" });
    if (error) { logServerError("admin-settings-update", error, { actorId: actor.id }); return NextResponse.json({ error: "Could not save platform settings." }, { status: 500 }); }
  }
  if (parsed.data.features) {
    const featureRows = Object.entries(parsed.data.features).map(([key, enabled]) => ({ key, enabled, updated_at: new Date().toISOString() }));
    const { error } = await admin.from("feature_flags").upsert(featureRows, { onConflict: "key" });
    if (error) { logServerError("admin-feature-flags-update", error, { actorId: actor.id }); return NextResponse.json({ error: "Could not save feature flags." }, { status: 500 }); }
  }
  await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "platform_settings.updated", entity_type: "system_settings", metadata: parsed.data });
  return NextResponse.json({ ok: true });
}
