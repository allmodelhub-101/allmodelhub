import Decimal from "decimal.js";

Decimal.set({
  precision: 100,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1_000_000,
  toExpPos: 1_000_000,
});

export type DecimalInput = string | Decimal;
export type DecimalString = string & { readonly __decimalString: unique symbol };

export const CREDIT_TO_PKR_RATE = "1" as DecimalString;

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function decimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  const normalized = value.trim();
  if (!DECIMAL_PATTERN.test(normalized)) throw new TypeError(`Invalid decimal value: ${value}`);
  const result = new Decimal(normalized);
  if (!result.isFinite()) throw new TypeError(`Decimal value must be finite: ${value}`);
  return result;
}

export function decimalString(value: DecimalInput): DecimalString {
  const result = decimal(value);
  if (result.isZero()) return "0" as DecimalString;
  return result.toFixed() as DecimalString;
}

function positiveRate(value: DecimalInput, name: string): Decimal {
  const result = decimal(value);
  if (!result.gt(0)) throw new RangeError(`${name} must be greater than zero.`);
  return result;
}

export function usdToPkr(usd: DecimalInput, internalUsdPkrRate: DecimalInput): DecimalString {
  return decimalString(decimal(usd).mul(positiveRate(internalUsdPkrRate, "Internal USD/PKR rate")));
}

export function pkrToUsd(pkr: DecimalInput, internalUsdPkrRate: DecimalInput): DecimalString {
  return decimalString(decimal(pkr).div(positiveRate(internalUsdPkrRate, "Internal USD/PKR rate")));
}

export function pkrToCredits(pkr: DecimalInput): DecimalString {
  return decimalString(pkr);
}

export function creditsToPkr(credits: DecimalInput): DecimalString {
  return decimalString(credits);
}

export function usdToCredits(usd: DecimalInput, internalUsdPkrRate: DecimalInput): DecimalString {
  return pkrToCredits(usdToPkr(usd, internalUsdPkrRate));
}

export function creditsToUsd(credits: DecimalInput, internalUsdPkrRate: DecimalInput): DecimalString {
  return pkrToUsd(creditsToPkr(credits), internalUsdPkrRate);
}

export function add(...values: DecimalInput[]): DecimalString {
  return decimalString(values.reduce<Decimal>((sum, value) => sum.plus(decimal(value)), new Decimal(0)));
}

export function multiply(left: DecimalInput, right: DecimalInput): DecimalString {
  return decimalString(decimal(left).mul(decimal(right)));
}
