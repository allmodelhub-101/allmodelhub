import { createAdminClient } from "@/lib/supabase/admin";

export async function checkAdmin(userId:string){
  const supabase = createAdminClient();
  const [profileResult, adminRoleResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("admin_roles").select("role").eq("user_id", userId).maybeSingle()
  ]);

  if (profileResult.error || adminRoleResult.error) return false;

  return [profileResult.data?.role, adminRoleResult.data?.role]
    .some((role) => role === "admin" || role === "owner");
}
