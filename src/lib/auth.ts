import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/admin/check-admin";

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
  if (!(await checkAdmin(user.id))) redirect("/chat");
  return user;
}
