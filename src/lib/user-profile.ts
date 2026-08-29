import { createAdminClient } from "@/lib/supabase/admin";

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const admin = createAdminClient();
  const metadata = user.user_metadata ?? {};
  const displayName = (typeof metadata.full_name === "string" && metadata.full_name) || (typeof metadata.name === "string" && metadata.name) || user.email?.split("@")[0] || "Member";
  const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const role = bootstrap && user.email?.toLowerCase() === bootstrap ? "owner" : undefined;
  const profile: Record<string, unknown> = { id: user.id, email: user.email, display_name: displayName };
  if (role) profile.role = role;
  const { error } = await admin.from("profiles").upsert(profile, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw error;
  await admin.from("wallets").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}
