import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type DELETE MY ACCOUNT to confirm." }, { status: 400 });
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({ actor_user_id: data.user.id, action: "account_delete_requested", entity_type: "user", entity_id: data.user.id });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
