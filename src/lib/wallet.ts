import { createAdminClient } from "@/lib/supabase/admin";

export async function getWallet(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("purchased_balance,promo_balance,reserved_balance,updated_at")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  const purchased = Number(data.purchased_balance ?? 0);
  const promo = Number(data.promo_balance ?? 0);
  const reserved = Number(data.reserved_balance ?? 0);
  return { purchased, promo, reserved, available: purchased + promo - reserved, updatedAt: data.updated_at };
}

export async function createWalletHold(userId: string, amount: number, idempotencyKey: string, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_wallet_hold", {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_metadata: metadata
  });
  if (error) throw error;
  return data as string;
}

export async function captureWalletHold(holdId: string, amount: number, idempotencyKey: string, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("capture_wallet_hold", {
    p_hold_id: holdId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_metadata: metadata
  });
  if (error) throw error;
  return data as string;
}

export async function releaseWalletHold(holdId: string, reason = "released") {
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_wallet_hold", { p_hold_id: holdId, p_reason: reason });
  if (error) throw error;
}

export async function creditPurchasedWallet(userId: string, amount: number, idempotencyKey: string, referenceId: string, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("credit_wallet", {
    p_user_id: userId,
    p_amount: amount,
    p_bucket: "purchased",
    p_type: "credit_purchase",
    p_idempotency_key: idempotencyKey,
    p_reference_id: referenceId,
    p_metadata: metadata
  });
  if (error) throw error;
  return data as string;
}

export async function grantWelcomeCredits(userId: string, amount: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_welcome_credits", { p_user_id: userId, p_amount: amount });
  if (error) throw error;
  return Boolean(data);
}
