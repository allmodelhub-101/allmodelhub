import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const schema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  defaultLanguage: z.enum(["auto", "en", "ur", "roman-ur"]).optional(),
  defaultTier: z.enum(["auto", "budget", "balanced", "premium", "flagship"]).optional(),
  lowBandwidth: z.boolean().optional(),
  dailySpendLimit: z.number().positive().nullable().optional(),
  singleGenerationLimit: z.number().positive().nullable().optional(),
  customInstructions: z.string().max(8000).optional()
});

export async function GET() {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient(); const { data: profile, error } = await admin.from("profiles").select("*").eq("id", data.user.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings", details: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data; const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (v.displayName !== undefined) patch.display_name = v.displayName;
  if (v.theme !== undefined) patch.theme = v.theme;
  if (v.defaultLanguage !== undefined) patch.default_language = v.defaultLanguage;
  if (v.defaultTier !== undefined) patch.default_tier = v.defaultTier;
  if (v.lowBandwidth !== undefined) patch.low_bandwidth = v.lowBandwidth;
  if (v.dailySpendLimit !== undefined) patch.daily_spend_limit = v.dailySpendLimit;
  if (v.singleGenerationLimit !== undefined) patch.single_generation_limit = v.singleGenerationLimit;
  if (v.customInstructions !== undefined) patch.custom_instructions = v.customInstructions;
  const admin = createAdminClient(); const { data: profile, error } = await admin.from("profiles").update(patch).eq("id", data.user.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profile });
}
