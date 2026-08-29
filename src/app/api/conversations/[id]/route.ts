import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const patchSchema = z.object({ title: z.string().min(1).max(120).optional(), pinned: z.boolean().optional(), archived: z.boolean().optional() });

async function auth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("conversations").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const { error } = await admin.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
