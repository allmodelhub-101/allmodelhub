import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyUser(userId: string, input: { type?: string; title: string; body: string; href?: string }) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type: input.type || "info", title: input.title, body: input.body, href: input.href || null });
}
