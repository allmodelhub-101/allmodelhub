import Decimal from "decimal.js";
import type { CatalogModel } from "../models";
import type { DecimalString } from "./money";
import type { NormalizedUsage } from "./types";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

function value(input: string | undefined) {
  const parsed = new Decimal(input ?? "0");
  if (!parsed.isFinite() || parsed.lt(0)) throw new TypeError("Legacy shadow usage must be nonnegative.");
  return parsed;
}

function text(input: Decimal) {
  return (input.isZero() ? "0" : input.toFixed()) as DecimalString;
}

/** Reproduces the retired catalog calculation for comparison only. Never use this result for capture. */
export function calculateLegacyShadowCharge(input: Readonly<{
  model: CatalogModel;
  phase: "quote" | "settlement" | "failure";
  usage: NormalizedUsage;
  internalUsdPkrRate: string;
  qualityMultiplier?: string;
}>) {
  if (input.phase === "failure") return "0" as DecimalString;
  const fx = value(input.internalUsdPkrRate);
  const markup = new Decimal(String(input.model.markup));
  let supplierUsd = new Decimal(0);
  if (input.model.modality === "text") {
    supplierUsd = value(input.usage.inputTokens).mul(String(input.model.inputUsdPerMillion ?? 0)).plus(
      value(input.usage.outputTokens).mul(String(input.model.outputUsdPerMillion ?? 0)),
    ).div(1_000_000);
    let credits = supplierUsd.mul(fx).mul(markup);
    if (input.phase === "quote") credits = credits.mul("1.2");
    return text(Decimal.max(input.phase === "quote" ? "0.05" : "0.000001", credits.toDecimalPlaces(6)));
  }
  supplierUsd = supplierUsd.plus(String(input.model.flatUsd ?? 0));
  if (input.model.perSecondUsd) supplierUsd = supplierUsd.plus(value(input.usage.seconds).mul(String(input.model.perSecondUsd)));
  if (input.model.per1kCharsUsd) supplierUsd = supplierUsd.plus(value(input.usage.characters).div(1000).mul(String(input.model.per1kCharsUsd)));
  supplierUsd = supplierUsd.mul(value(input.qualityMultiplier ?? "1"));
  return text(Decimal.max("0.05", supplierUsd.mul(fx).mul(markup).toDecimalPlaces(6)));
}
