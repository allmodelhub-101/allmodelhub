import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  active: z.boolean().optional(), featured: z.boolean().optional(), autoEligible: z.boolean().optional(),
  markup: z.number().min(1).max(20).optional(),
  tier: z.enum(["budget", "balanced", "premium", "flagship"]).optional(),
  upstreamModel: z.string().min(1).max(200).optional(),
  inputUsdPerMillion: z.number().min(0).nullable().optional(), outputUsdPerMillion: z.number().min(0).nullable().optional(),
  flatUsd: z.number().min(0).nullable().optional(), perSecondUsd: z.number().min(0).nullable().optional(), per1kCharsUsd: z.number().min(0).nullable().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(); const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid model update", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params; const admin = createAdminClient();
  const { data: current } = await admin.from("models").select("*").eq("id", id).maybeSingle(); if (!current) return NextResponse.json({ error: "Model not found" }, { status: 404 });
  const v = parsed.data; const priceFieldsChanged = [v.markup, v.inputUsdPerMillion, v.outputUsdPerMillion, v.flatUsd, v.perSecondUsd, v.per1kCharsUsd].some((x) => x !== undefined);
  const nextVersion = priceFieldsChanged ? Number(current.price_version ?? 1) + 1 : Number(current.price_version ?? 1);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (v.active !== undefined) patch.active = v.active; if (v.featured !== undefined) patch.featured = v.featured; if (v.autoEligible !== undefined) patch.auto_eligible = v.autoEligible;
  if (v.markup !== undefined) patch.markup = v.markup; if (v.tier !== undefined) patch.tier = v.tier; if (v.upstreamModel !== undefined) patch.upstream_model = v.upstreamModel;
  if (v.inputUsdPerMillion !== undefined) patch.input_usd_per_million = v.inputUsdPerMillion; if (v.outputUsdPerMillion !== undefined) patch.output_usd_per_million = v.outputUsdPerMillion;
  if (v.flatUsd !== undefined) patch.flat_usd = v.flatUsd; if (v.perSecondUsd !== undefined) patch.per_second_usd = v.perSecondUsd; if (v.per1kCharsUsd !== undefined) patch.per_1k_chars_usd = v.per1kCharsUsd;
  if (priceFieldsChanged) patch.price_version = nextVersion;
  const { data: model, error } = await admin.from("models").update(patch).eq("id", id).select("*").single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (priceFieldsChanged) await admin.from("model_price_history").insert({ model_id: id, version: nextVersion, created_by: user.id, pricing: { input_usd_per_million: model.input_usd_per_million, output_usd_per_million: model.output_usd_per_million, flat_usd: model.flat_usd, per_second_usd: model.per_second_usd, per_1k_chars_usd: model.per_1k_chars_usd, markup: model.markup } });
  await admin.from("audit_logs").insert({ actor_user_id: user.id, action: "model.updated", entity_type: "model", entity_id: id, metadata: patch });
  return NextResponse.json({ model });
}
