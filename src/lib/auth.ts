import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/login");
  return data.user;
}

export async function getUserOrNull() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireAdmin() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!data || !["admin", "owner"].includes(data.role)) redirect("/chat");
  return user;
}
