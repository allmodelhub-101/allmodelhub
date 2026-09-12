import type { SupabaseClient } from "@supabase/supabase-js";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export type StorageQuota = {
  tier: "free" | "creator" | "studio";
  label: string;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  maxFileBytes: number;
  percent: number;
  lifetimePurchasedCredits: number;
};

export async function getStorageQuota(admin: SupabaseClient, userId: string): Promise<StorageQuota> {
  const [{ data: files, error: filesError }, { data: payments, error: paymentsError }] = await Promise.all([
    admin.from("user_files").select("size_bytes").eq("user_id", userId),
    admin.from("manual_payments").select("credits").eq("user_id", userId).eq("status", "approved")
  ]);
  if (filesError) throw filesError;
  if (paymentsError) throw paymentsError;

  const usedBytes = (files ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.size_bytes) || 0), 0);
  const lifetimePurchasedCredits = (payments ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.credits) || 0), 0);
  const plan = lifetimePurchasedCredits >= 5000
    ? { tier: "studio" as const, label: "Studio storage", limitBytes: 5 * GB, maxFileBytes: 50 * MB }
    : lifetimePurchasedCredits > 0
      ? { tier: "creator" as const, label: "Creator storage", limitBytes: GB, maxFileBytes: 50 * MB }
      : { tier: "free" as const, label: "Free storage", limitBytes: 25 * MB, maxFileBytes: 10 * MB };
  const remainingBytes = Math.max(0, plan.limitBytes - usedBytes);
  return {
    ...plan,
    usedBytes,
    remainingBytes,
    lifetimePurchasedCredits,
    percent: Math.min(100, (usedBytes / plan.limitBytes) * 100)
  };
}


