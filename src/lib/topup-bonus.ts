export const TOPUP_MIN_PKR = 500;
export const TOPUP_MAX_PKR = 100_000;

export type TopupBonusTier = { minimum: number; percent: number; label: string; badge?: string };

export const TOPUP_BONUS_TIERS: readonly TopupBonusTier[] = [
  { minimum: 500, percent: 5, label: "5%" },
  { minimum: 1_000, percent: 10, label: "10%" },
  { minimum: 2_500, percent: 13, label: "13%" },
  { minimum: 5_000, percent: 15, label: "15%", badge: "Most popular" },
  { minimum: 10_000, percent: 20, label: "20%", badge: "Best value" }
] as const;

export function isValidTopupAmount(amount: number) {
  return Number.isInteger(amount) && amount >= TOPUP_MIN_PKR && amount <= TOPUP_MAX_PKR;
}

export function calculateTopupBonus(amount: number) {
  if (!isValidTopupAmount(amount)) return { percent: 0, bonusCredits: 0, totalCredits: 0 };
  const tier = [...TOPUP_BONUS_TIERS].reverse().find((item) => amount >= item.minimum)!;
  const bonusCredits = Math.round(amount * tier.percent) / 100;
  return { percent: tier.percent, bonusCredits, totalCredits: amount + bonusCredits };
}

export function getNextTopupTier(amount: number) {
  const next = TOPUP_BONUS_TIERS.find((item) => amount < item.minimum);
  return next ? { ...next, remaining: Math.max(0, next.minimum - Math.max(0, amount)) } : null;
}

