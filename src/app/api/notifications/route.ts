import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/public-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: notifications, error } = await admin.from("notifications").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) { logServerError("notifications-read", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not load notifications." }, { status: 500 }); }
  return NextResponse.json({ notifications: notifications ?? [] });
}

const patchSchema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).refine((v) => v.id || v.all, "id or all required");
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const admin = createAdminClient();
  let query = admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", data.user.id).is("read_at", null);
  if (parsed.data.id) query = query.eq("id", parsed.data.id);
  const { error } = await query;
  if (error) { logServerError("notifications-read", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not load notifications." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
