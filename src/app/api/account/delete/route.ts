import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/public-error";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await enforceRateLimit(`account-delete:${data.user.id}`, "auth");
  if (limit.unavailable) return NextResponse.json({ error: "Account protection is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many deletion attempts." }, { status: 429 });
  const signedInAt = data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at).getTime() : 0;
  if (!signedInAt || Date.now() - signedInAt > 15 * 60_000) {
    return NextResponse.json({ error: "Please sign in again before deleting your account." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type DELETE MY ACCOUNT to confirm." }, { status: 400 });
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({ actor_user_id: data.user.id, action: "account_delete_requested", entity_type: "user", entity_id: data.user.id });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) { logServerError("account-delete", error, { userId: data.user.id }); return NextResponse.json({ error: "Could not delete account." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
