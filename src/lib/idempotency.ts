import { createAdminClient } from "@/lib/supabase/admin";

export type IdempotencyClaim = { claimed: true; id: string } | { claimed: false; existing: { id: string; status: string; resource_id?: string | null; response_json?: unknown } };

export async function claimRequest(userId: string, scope: string, requestKey: string): Promise<IdempotencyClaim> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("request_idempotency").insert({ user_id: userId, scope, request_key: requestKey, status: "processing" }).select("id").single();
  if (!error && data) return { claimed: true, id: data.id };
  // Postgres unique violation = another copy of the same client request was already claimed.
  if (error?.code !== "23505") throw error;
  const { data: existing, error: readError } = await admin.from("request_idempotency").select("id,status,resource_id,response_json").eq("user_id", userId).eq("scope", scope).eq("request_key", requestKey).single();
  if (readError) throw readError;
  return { claimed: false, existing };
}

export async function finalizeRequest(id: string, status: "completed" | "failed", options?: { resourceId?: string | null; response?: unknown }) {
  const admin = createAdminClient();
  await admin.from("request_idempotency").update({ status, resource_id: options?.resourceId ?? null, response_json: options?.response ?? null, updated_at: new Date().toISOString() }).eq("id", id);
}
