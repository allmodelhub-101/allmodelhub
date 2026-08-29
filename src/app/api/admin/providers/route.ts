import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/public-error";

const schema = z.object({
  modelId: z.string().min(1),
  providerKey: z.enum(["apimodels", "haimaker"]),
  upstreamModel: z.string().min(1).max(200),
  priority: z.number().int().min(1).max(1000).default(100),
  active: z.boolean().default(true)
});

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("provider_models").select("*").order("model_id").order("priority");
  if (error) { logServerError("admin-provider-list", error); return NextResponse.json({ error: "Could not load provider routes." }, { status: 500 }); }
  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider route", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.from("provider_models").upsert({
    model_id: input.modelId,
    provider_key: input.providerKey,
    upstream_model: input.upstreamModel,
    priority: input.priority,
    active: input.active
  }, { onConflict: "model_id,provider_key" }).select("*").single();
  if (error) { logServerError("admin-provider-update", error, { actorId: user.id, modelId: input.modelId }); return NextResponse.json({ error: "Could not update provider route." }, { status: 500 }); }
  await admin.from("audit_logs").insert({ actor_user_id: user.id, action: "provider_route.updated", entity_type: "provider_model", entity_id: data.id, metadata: data });
  return NextResponse.json({ route: data });
}
