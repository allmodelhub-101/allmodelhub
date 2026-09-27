import { createAdminClient } from "@/lib/supabase/admin";
import { decimal, type DecimalInput } from "@/lib/billing/money";

function karachiDayStartIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  // Karachi is UTC+05 and has no daylight-saving time.
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+05:00`).toISOString();
}

export async function assertSpendingAllowed(userId: string, proposedCredits: DecimalInput) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("daily_spend_limit,single_generation_limit").eq("id", userId).single();
  const proposed = decimal(proposedCredits);
  if (profile?.single_generation_limit && proposed.gt(decimal(String(profile.single_generation_limit)))) {
    throw new Error(`SINGLE_SPEND_LIMIT:${profile.single_generation_limit}`);
  }
  if (profile?.daily_spend_limit) {
    const { data: txs } = await admin.from("wallet_transactions").select("amount").eq("user_id", userId).eq("type", "generation_capture").gte("created_at", karachiDayStartIso());
    const spent = (txs ?? []).reduce((sum, tx) => sum.plus(decimal(String(tx.amount)).abs()), decimal("0"));
    if (spent.plus(proposed).gt(decimal(String(profile.daily_spend_limit)))) {
      throw new Error(`DAILY_SPEND_LIMIT:${profile.daily_spend_limit}`);
    }
  }
}
