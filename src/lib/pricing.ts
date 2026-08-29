import type { CatalogModel } from "@/lib/models";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_INTERNAL_USD_PKR = Number(process.env.INTERNAL_USD_PKR || 310);

export async function getInternalUsdPkr() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("system_settings").select("value").eq("key", "internal_usd_pkr").maybeSingle();
    if (error || data?.value === undefined || data?.value === null) return DEFAULT_INTERNAL_USD_PKR;
    const value = Number(data.value);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERNAL_USD_PKR;
  } catch {
    return DEFAULT_INTERNAL_USD_PKR;
  }
}

export function creditsFromUsd(usd: number, markup: number, fxRate = DEFAULT_INTERNAL_USD_PKR) {
  return Number((usd * fxRate * markup).toFixed(6));
}

export function estimateTextHold(model: CatalogModel, promptText: string, maxOutputTokens = 2048, fxRate = DEFAULT_INTERNAL_USD_PKR) {
  const estimatedInputTokens = Math.ceil(promptText.length / 3.4) + (model.inputOverheadTokens ?? 0);
  const inputUsd = (estimatedInputTokens * (model.inputUsdPerMillion ?? 0)) / 1_000_000;
  const outputUsd = (maxOutputTokens * (model.outputUsdPerMillion ?? 0)) / 1_000_000;
  const retail = creditsFromUsd(inputUsd + outputUsd, model.markup, fxRate);
  return Math.max(0.05, Number((retail * 1.2).toFixed(6)));
}

export function textSupplierUsd(model: CatalogModel, inputTokens: number, outputTokens: number) {
  return (inputTokens * (model.inputUsdPerMillion ?? 0) + outputTokens * (model.outputUsdPerMillion ?? 0)) / 1_000_000;
}

export function actualTextCredits(model: CatalogModel, inputTokens: number, outputTokens: number, fxRate = DEFAULT_INTERNAL_USD_PKR) {
  const usd = textSupplierUsd(model, inputTokens, outputTokens);
  return Math.max(0.000001, creditsFromUsd(usd, model.markup, fxRate));
}

export function mediaSupplierUsd(model: CatalogModel, input: { duration?: number; textLength?: number; qualityMultiplier?: number }) {
  let usd = model.flatUsd ?? 0;
  if (model.perSecondUsd) usd += model.perSecondUsd * Math.max(1, input.duration ?? 1);
  if (model.per1kCharsUsd) usd += model.per1kCharsUsd * Math.max(0.001, (input.textLength ?? 1) / 1000);
  return usd * (input.qualityMultiplier ?? 1);
}

export function estimateMediaCredits(model: CatalogModel, input: { duration?: number; textLength?: number; qualityMultiplier?: number }, fxRate = DEFAULT_INTERNAL_USD_PKR) {
  return Math.max(0.05, creditsFromUsd(mediaSupplierUsd(model, input), model.markup, fxRate));
}
