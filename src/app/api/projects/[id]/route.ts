import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  instructions: z.string().max(10_000).nullable().optional(),
  preferredTier: z.enum(["auto", "budget", "balanced", "premium", "flagship"]).optional(),
  preferredLanguage: z.string().max(40).optional()
});

async function authProject(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("id").eq("id", id).eq("user_id", data.user.id).maybeSingle();
  if (!project) return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  return { user: data.user, admin };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authProject(id); if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project update" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.instructions !== undefined) patch.instructions = parsed.data.instructions;
  if (parsed.data.preferredTier !== undefined) patch.preferred_tier = parsed.data.preferredTier;
  if (parsed.data.preferredLanguage !== undefined) patch.preferred_language = parsed.data.preferredLanguage;
  const { data: project, error } = await auth.admin!.from("projects").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authProject(id); if (auth.error) return auth.error;
  const { error } = await auth.admin!.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
