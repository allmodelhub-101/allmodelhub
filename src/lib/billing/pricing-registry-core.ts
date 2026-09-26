import Decimal from "decimal.js";
import type { DecimalString } from "./money";
import type { Currency, NormalizedUsage, PricingStatus } from "./types";

Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -1_000_000, toExpPos: 1_000_000 });

export type BillingType = "token" | "flat" | "image" | "time" | "character" | "reference" | "composite" | "formula";
export type PricingErrorCode =
  | "RULE_NOT_FOUND"
  | "RULE_AMBIGUOUS"
  | "RULE_INACTIVE"
  | "RULE_NOT_EFFECTIVE"
  | "RULE_EXPIRED"
  | "RULE_NOT_VERIFIED"
  | "RULE_STALE"
  | "RULE_BLOCKED"
  | "RULE_PENDING_REVIEW"
  | "RULE_INVALID"
  | "MODEL_INACTIVE"
  | "DIMENSION_REQUIRED"
  | "DIMENSION_UNSUPPORTED"
  | "USAGE_REQUIRED"
  | "FORMULA_UNSUPPORTED"
  | "FX_RATE_UNAVAILABLE"
  | "MARKUP_INVALID";

export class PricingUnavailableError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingUnavailableError";
    this.code = code;
  }
}

export type PricingDimensions = Readonly<{
  resolution?: string;
  quality?: string;
  mode?: string;
  inputType?: string;
}>;

export type PricingRegistryRow = Readonly<{
  id: string;
  provider_key: string;
  model_id: string;
  upstream_model: string;
  pricing_version: string;
  billing_type: string;
  currency: string;
  input_token_price: string | null;
  output_token_price: string | null;
  cached_token_price: string | null;
  cache_write_token_price: string | null;
  flat_price: string | null;
  per_image_price: string | null;
  per_second_price: string | null;
  per_minute_price: string | null;
  per_1k_character_price: string | null;
  per_reference_image_price: string | null;
  resolution_dimensions: unknown;
  quality_dimensions: unknown;
  mode_dimensions: unknown;
  input_type_dimensions: unknown;
  formula: unknown;
  metadata: unknown;
  effective_from: string;
  effective_until: string | null;
  verified_at: string | null;
  source_name: string | null;
  source_url: string | null;
  source_metadata: unknown;
  status: string;
  active: boolean;
  model_markup: string;
  model_active: boolean;
}>;

type DecimalRates = Readonly<{
  inputToken: DecimalString | null;
  outputToken: DecimalString | null;
  cachedToken: DecimalString | null;
  cacheWriteToken: DecimalString | null;
  flat: DecimalString | null;
  perImage: DecimalString | null;
  perSecond: DecimalString | null;
  perMinute: DecimalString | null;
  per1kCharacters: DecimalString | null;
  perReferenceImage: DecimalString | null;
}>;

export type ValidatedPricingRule = Readonly<{
  id: string;
  providerKey: string;
  modelId: string;
  upstreamModel: string;
  pricingVersion: string;
  billingType: BillingType;
  currency: Currency;
  rates: DecimalRates;
  resolutionDimensions: Readonly<Record<string, unknown>>;
  qualityDimensions: Readonly<Record<string, unknown>>;
  modeDimensions: Readonly<Record<string, unknown>>;
  inputTypeDimensions: Readonly<Record<string, unknown>>;
  formula: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
  effectiveFrom: string;
  effectiveUntil: string | null;
  verifiedAt: string;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceMetadata: Readonly<Record<string, unknown>>;
  status: "verified";
  markup: DecimalString;
}>;

export type PricingRuleSelector = Readonly<{
  providerKey: string;
  modelId: string;
  upstreamModel: string;
  pricingVersion?: string;
  at?: Date;
}>;

export type FormulaContext = Readonly<{
  usage: NormalizedUsage;
  dimensions: PricingDimensions;
  formula: Readonly<Record<string, unknown>>;
}>;

export type FormulaEvaluator = (context: FormulaContext) => Readonly<{
  amount: DecimalString;
  operation?: "add" | "replace";
}>;

export type PricingBreakdown = Readonly<{
  code: string;
  quantity: DecimalString;
  unitPrice: DecimalString;
  amount: DecimalString;
}>;

export type AuthoritativePrice = Readonly<{
  providerCost: Readonly<{ amount: DecimalString; currency: Currency }>;
  providerCostUsd: DecimalString;
  customerChargeCredits: DecimalString;
  breakdown: readonly PricingBreakdown[];
  snapshot: Readonly<{
    pricingRuleId: string;
    providerKey: string;
    modelId: string;
    upstreamModel: string;
    pricingVersion: string;
    pricingStatus: "verified";
    internalUsdPkrRate: DecimalString;
    markup: DecimalString;
    dimensions: PricingDimensions;
    rates: DecimalRates;
    formula: Readonly<Record<string, unknown>>;
    effectiveFrom: string;
    effectiveUntil: string | null;
    verifiedAt: string;
    sourceName: string | null;
    sourceUrl: string | null;
  }>;
}>;

const BILLING_TYPES = new Set<BillingType>(["token", "flat", "image", "time", "character", "reference", "composite", "formula"]);
const CURRENCIES = new Set<Currency>(["USD", "PKR", "CREDIT"]);
const STATUSES = new Set<PricingStatus>(["verified", "stale", "blocked", "pending_review"]);

function fail(code: PricingErrorCode, message: string): never {
  throw new PricingUnavailableError(code, message);
}

function exactDecimal(value: unknown, field: string, options: { positive?: boolean } = {}): DecimalString {
  if (typeof value !== "string" || !value.trim()) fail("RULE_INVALID", `${field} must be an exact decimal string.`);
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    fail("RULE_INVALID", `${field} is not a valid decimal.`);
  }
  if (!parsed.isFinite() || parsed.lt(0) || (options.positive && !parsed.gt(0))) {
    fail("RULE_INVALID", `${field} is outside the allowed range.`);
  }
  return parsed.toFixed() as DecimalString;
}

function optionalDecimal(value: unknown, field: string): DecimalString | null {
  return value === null || value === undefined ? null : exactDecimal(value, field);
}

function exactPositiveDecimal(value: unknown, field: string, code: "FX_RATE_UNAVAILABLE" | "MARKUP_INVALID"): DecimalString {
  if (typeof value !== "string" || !value.trim()) fail(code, `${field} must be an exact positive decimal string.`);
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite() || !parsed.gt(0)) fail(code, `${field} must be greater than zero.`);
    return parsed.toFixed() as DecimalString;
  } catch (error) {
    if (error instanceof PricingUnavailableError) throw error;
    fail(code, `${field} is not a valid decimal.`);
  }
}

function objectValue(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("RULE_INVALID", `${field} must be an object.`);
  return value as Readonly<Record<string, unknown>>;
}

function validDate(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail("RULE_INVALID", `${field} is invalid.`);
  return date;
}

function statusError(status: PricingStatus): never {
  if (status === "stale") fail("RULE_STALE", "The provider pricing rule is stale.");
  if (status === "blocked") fail("RULE_BLOCKED", "The provider pricing rule is blocked.");
  if (status === "pending_review") fail("RULE_PENDING_REVIEW", "The provider pricing rule is pending review.");
  fail("RULE_NOT_VERIFIED", "The provider pricing rule is not verified.");
}

function validateStrategy(rule: ValidatedPricingRule) {
  const rates = rule.rates;
  const hasDimensions = [rule.resolutionDimensions, rule.qualityDimensions, rule.modeDimensions, rule.inputTypeDimensions]
    .some((map) => Object.keys(map).length > 0);
  if (rates.perSecond && rates.perMinute) fail("RULE_INVALID", "A rule cannot price both per-second and per-minute time.");
  if (rule.billingType === "token" && ![rates.inputToken, rates.outputToken, rates.cachedToken, rates.cacheWriteToken].some(Boolean)) {
    fail("RULE_INVALID", "Token pricing requires at least one token rate.");
  }
  if (rule.billingType === "character" && !rates.per1kCharacters) fail("RULE_INVALID", "Character pricing requires a per-1k-character rate.");
  if (rule.billingType === "flat" && !rates.flat) fail("RULE_INVALID", "Flat pricing requires a flat rate.");
  if (rule.billingType === "image" && !rates.flat && !rates.perImage && !hasDimensions) fail("RULE_INVALID", "Image pricing requires an image, flat, or dimension rate.");
  if (rule.billingType === "time" && !rates.perSecond && !rates.perMinute && !hasDimensions) fail("RULE_INVALID", "Time pricing requires a duration rate.");
  if (rule.billingType === "reference" && !rates.perReferenceImage) fail("RULE_INVALID", "Reference pricing requires a reference-image rate.");
  if (rule.billingType === "formula" && Object.keys(rule.formula).length === 0) fail("RULE_INVALID", "Formula pricing requires a formula.");
}

function validateRow(row: PricingRegistryRow, at: Date): ValidatedPricingRule {
  if (!row.model_active) fail("MODEL_INACTIVE", "The model is inactive.");
  if (!STATUSES.has(row.status as PricingStatus)) fail("RULE_INVALID", "The provider pricing status is invalid.");
  if (row.status !== "verified") statusError(row.status as PricingStatus);
  if (!row.active) fail("RULE_INACTIVE", "The provider pricing rule is inactive.");
  if (!row.verified_at) fail("RULE_NOT_VERIFIED", "The provider pricing rule has not been verified.");
  const effectiveFrom = validDate(row.effective_from, "effective_from");
  if (effectiveFrom > at) fail("RULE_NOT_EFFECTIVE", "The provider pricing rule is not effective yet.");
  if (row.effective_until && validDate(row.effective_until, "effective_until") <= at) fail("RULE_EXPIRED", "The provider pricing rule has expired.");
  if (!BILLING_TYPES.has(row.billing_type as BillingType)) fail("RULE_INVALID", "The billing type is unsupported.");
  if (!CURRENCIES.has(row.currency as Currency)) fail("RULE_INVALID", "The pricing currency is unsupported.");

  const rule: ValidatedPricingRule = {
    id: row.id,
    providerKey: row.provider_key,
    modelId: row.model_id,
    upstreamModel: row.upstream_model,
    pricingVersion: row.pricing_version,
    billingType: row.billing_type as BillingType,
    currency: row.currency as Currency,
    rates: {
      inputToken: optionalDecimal(row.input_token_price, "input_token_price"),
      outputToken: optionalDecimal(row.output_token_price, "output_token_price"),
      cachedToken: optionalDecimal(row.cached_token_price, "cached_token_price"),
      cacheWriteToken: optionalDecimal(row.cache_write_token_price, "cache_write_token_price"),
      flat: optionalDecimal(row.flat_price, "flat_price"),
      perImage: optionalDecimal(row.per_image_price, "per_image_price"),
      perSecond: optionalDecimal(row.per_second_price, "per_second_price"),
      perMinute: optionalDecimal(row.per_minute_price, "per_minute_price"),
      per1kCharacters: optionalDecimal(row.per_1k_character_price, "per_1k_character_price"),
      perReferenceImage: optionalDecimal(row.per_reference_image_price, "per_reference_image_price"),
    },
    resolutionDimensions: objectValue(row.resolution_dimensions, "resolution_dimensions"),
    qualityDimensions: objectValue(row.quality_dimensions, "quality_dimensions"),
    modeDimensions: objectValue(row.mode_dimensions, "mode_dimensions"),
    inputTypeDimensions: objectValue(row.input_type_dimensions, "input_type_dimensions"),
    formula: objectValue(row.formula, "formula"),
    metadata: objectValue(row.metadata, "metadata"),
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    verifiedAt: row.verified_at,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceMetadata: objectValue(row.source_metadata, "source_metadata"),
    status: "verified",
    markup: exactPositiveDecimal(row.model_markup, "model_markup", "MARKUP_INVALID"),
  };
  validateStrategy(rule);
  return rule;
}

export function selectPricingRule(rows: readonly PricingRegistryRow[], selector: PricingRuleSelector): ValidatedPricingRule {
  const at = selector.at ?? new Date();
  const identity = rows.filter((row) =>
    row.provider_key === selector.providerKey
    && row.model_id === selector.modelId
    && row.upstream_model === selector.upstreamModel
    && (!selector.pricingVersion || row.pricing_version === selector.pricingVersion));
  if (!identity.length) fail("RULE_NOT_FOUND", "No provider-specific pricing rule exists for this model and version.");

  if (selector.pricingVersion) {
    if (identity.length !== 1) fail("RULE_AMBIGUOUS", "Multiple rules match the exact provider pricing version.");
    return validateRow(identity[0], at);
  }

  const started = identity
    .filter((row) => validDate(row.effective_from, "effective_from") <= at)
    .sort((left, right) => validDate(right.effective_from, "effective_from").getTime() - validDate(left.effective_from, "effective_from").getTime());
  if (!started.length) return validateRow(identity[0], at);
  const latestEffectiveAt = validDate(started[0].effective_from, "effective_from").getTime();
  if (started.filter((row) => validDate(row.effective_from, "effective_from").getTime() === latestEffectiveAt).length > 1) {
    fail("RULE_AMBIGUOUS", "Multiple provider pricing rules share the latest effective time.");
  }
  return validateRow(started[0], at);
}

type Adjustment = Readonly<{
  flat?: DecimalString;
  perImage?: DecimalString;
  perSecond?: DecimalString;
  perMinute?: DecimalString;
  per1kCharacters?: DecimalString;
  perReferenceImage?: DecimalString;
  multiplier?: DecimalString;
}>;

function dimensionAdjustment(map: Readonly<Record<string, unknown>>, selected: string | undefined, name: string): Adjustment | null {
  if (Object.keys(map).length === 0) return null;
  if (!selected) fail("DIMENSION_REQUIRED", `${name} is required by this pricing rule.`);
  const raw = map[selected];
  if (raw === undefined) fail("DIMENSION_UNSUPPORTED", `${name} '${selected}' has no validated provider price.`);
  if (typeof raw === "string") return { flat: exactDecimal(raw, `${name}.${selected}`) };
  const object = objectValue(raw, `${name}.${selected}`);
  const allowed = new Set(["flat", "perImage", "perSecond", "perMinute", "per1kCharacters", "perReferenceImage", "multiplier"]);
  if (Object.keys(object).some((key) => !allowed.has(key))) fail("RULE_INVALID", `${name}.${selected} contains an unsupported pricing operation.`);
  const adjustment: Adjustment = {
    flat: object.flat === undefined ? undefined : exactDecimal(object.flat, `${name}.${selected}.flat`),
    perImage: object.perImage === undefined ? undefined : exactDecimal(object.perImage, `${name}.${selected}.perImage`),
    perSecond: object.perSecond === undefined ? undefined : exactDecimal(object.perSecond, `${name}.${selected}.perSecond`),
    perMinute: object.perMinute === undefined ? undefined : exactDecimal(object.perMinute, `${name}.${selected}.perMinute`),
    per1kCharacters: object.per1kCharacters === undefined ? undefined : exactDecimal(object.per1kCharacters, `${name}.${selected}.per1kCharacters`),
    perReferenceImage: object.perReferenceImage === undefined ? undefined : exactDecimal(object.perReferenceImage, `${name}.${selected}.perReferenceImage`),
    multiplier: object.multiplier === undefined ? undefined : exactDecimal(object.multiplier, `${name}.${selected}.multiplier`, { positive: true }),
  };
  if (!Object.values(adjustment).some(Boolean)) fail("RULE_INVALID", `${name}.${selected} has no pricing values.`);
  return adjustment;
}

function usageDecimal(value: DecimalString | undefined, field: string, required = false): Decimal {
  if (value === undefined) {
    if (required) fail("USAGE_REQUIRED", `${field} usage is required for this pricing rule.`);
    return new Decimal(0);
  }
  return new Decimal(exactDecimal(value, field));
}

function line(lines: PricingBreakdown[], code: string, quantity: Decimal, unitPrice: Decimal, amount = quantity.mul(unitPrice)) {
  if (amount.isZero()) return;
  lines.push({ code, quantity: quantity.toFixed() as DecimalString, unitPrice: unitPrice.toFixed() as DecimalString, amount: amount.toFixed() as DecimalString });
}

function applyAdjustment(total: Decimal, adjustment: Adjustment, usage: NormalizedUsage, code: string, lines: PricingBreakdown[]) {
  let result = total;
  const images = usageDecimal(usage.images, "images", Boolean(adjustment.perImage));
  const seconds = usageDecimal(usage.seconds, "seconds", Boolean(adjustment.perSecond || adjustment.perMinute));
  const characters = usageDecimal(usage.characters, "characters", Boolean(adjustment.per1kCharacters));
  const references = usageDecimal(usage.references, "references", false);
  const additions: Array<[string, Decimal, Decimal]> = [];
  if (adjustment.flat) additions.push([`${code}.flat`, new Decimal(1), new Decimal(adjustment.flat)]);
  if (adjustment.perImage) additions.push([`${code}.image`, images, new Decimal(adjustment.perImage)]);
  if (adjustment.perSecond) additions.push([`${code}.second`, seconds, new Decimal(adjustment.perSecond)]);
  if (adjustment.perMinute) additions.push([`${code}.minute`, seconds.div(60), new Decimal(adjustment.perMinute)]);
  if (adjustment.per1kCharacters) additions.push([`${code}.1k_characters`, characters.div(1000), new Decimal(adjustment.per1kCharacters)]);
  if (adjustment.perReferenceImage) additions.push([`${code}.reference`, references, new Decimal(adjustment.perReferenceImage)]);
  for (const [lineCode, quantity, rate] of additions) {
    const amount = quantity.mul(rate);
    line(lines, lineCode, quantity, rate, amount);
    result = result.plus(amount);
  }
  if (adjustment.multiplier) {
    const multiplier = new Decimal(adjustment.multiplier);
    const adjusted = result.mul(multiplier);
    line(lines, `${code}.multiplier`, result, multiplier, adjusted.minus(result));
    result = adjusted;
  }
  return result;
}

function dimensionValue(context: FormulaContext, key: string): Decimal {
  const usage = context.usage as Readonly<Record<string, unknown>>;
  const usageValue = usage[key];
  if (typeof usageValue === "string") return new Decimal(exactDecimal(usageValue, `formula.${key}`));
  const customValue = context.usage.dimensions?.[key];
  if (typeof customValue === "string") return new Decimal(exactDecimal(customValue, `formula.${key}`));
  fail("USAGE_REQUIRED", `Formula dimension '${key}' is missing.`);
}

export const linearFormulaEvaluator: FormulaEvaluator = ({ formula, ...context }) => {
  const base = formula.base === undefined ? new Decimal(0) : new Decimal(exactDecimal(formula.base, "formula.base"));
  if (!Array.isArray(formula.terms)) fail("RULE_INVALID", "Linear formula terms must be an array.");
  let amount = base;
  for (const [index, rawTerm] of formula.terms.entries()) {
    const term = objectValue(rawTerm, `formula.terms.${index}`);
    if (typeof term.dimension !== "string") fail("RULE_INVALID", `formula.terms.${index}.dimension is required.`);
    const rate = new Decimal(exactDecimal(term.rate, `formula.terms.${index}.rate`));
    amount = amount.plus(dimensionValue({ ...context, formula }, term.dimension).mul(rate));
  }
  const operation = formula.operation === undefined ? "add" : formula.operation;
  if (operation !== "add" && operation !== "replace") fail("RULE_INVALID", "Formula operation must be add or replace.");
  return { amount: amount.toFixed() as DecimalString, operation };
};

export function calculateAuthoritativePrice(input: Readonly<{
  rule: ValidatedPricingRule;
  usage: NormalizedUsage;
  dimensions?: PricingDimensions;
  internalUsdPkrRate: string;
  formulaEvaluators?: Readonly<Record<string, FormulaEvaluator>>;
}>): AuthoritativePrice {
  const fx = exactPositiveDecimal(input.internalUsdPkrRate, "internal_usd_pkr_rate", "FX_RATE_UNAVAILABLE");
  const dimensions = input.dimensions ?? {};
  const { rates } = input.rule;
  const lines: PricingBreakdown[] = [];
  let total = new Decimal(0);
  const additions: Array<[string, Decimal, Decimal]> = [];
  if (rates.flat) additions.push(["flat", new Decimal(1), new Decimal(rates.flat)]);
  if (rates.inputToken) additions.push(["input_tokens", usageDecimal(input.usage.inputTokens, "inputTokens", true), new Decimal(rates.inputToken)]);
  if (rates.outputToken) additions.push(["output_tokens", usageDecimal(input.usage.outputTokens, "outputTokens", true), new Decimal(rates.outputToken)]);
  if (rates.cachedToken) additions.push(["cached_tokens", usageDecimal(input.usage.cachedInputTokens, "cachedInputTokens").plus(usageDecimal(input.usage.cachedOutputTokens, "cachedOutputTokens")), new Decimal(rates.cachedToken)]);
  if (rates.cacheWriteToken) additions.push(["cache_write_tokens", usageDecimal(input.usage.cacheWriteTokens, "cacheWriteTokens"), new Decimal(rates.cacheWriteToken)]);
  if (rates.perImage) additions.push(["images", usageDecimal(input.usage.images, "images", true), new Decimal(rates.perImage)]);
  if (rates.perReferenceImage) additions.push(["reference_images", usageDecimal(input.usage.references, "references"), new Decimal(rates.perReferenceImage)]);
  if (rates.perSecond) additions.push(["seconds", usageDecimal(input.usage.seconds, "seconds", true), new Decimal(rates.perSecond)]);
  if (rates.perMinute) additions.push(["minutes", usageDecimal(input.usage.seconds, "seconds", true).div(60), new Decimal(rates.perMinute)]);
  if (rates.per1kCharacters) additions.push(["1k_characters", usageDecimal(input.usage.characters, "characters", true).div(1000), new Decimal(rates.per1kCharacters)]);
  for (const [code, quantity, rate] of additions) {
    const amount = quantity.mul(rate);
    line(lines, code, quantity, rate, amount);
    total = total.plus(amount);
  }

  const adjustments: Array<[string, Adjustment | null]> = [
    ["resolution", dimensionAdjustment(input.rule.resolutionDimensions, dimensions.resolution, "resolution")],
    ["quality", dimensionAdjustment(input.rule.qualityDimensions, dimensions.quality, "quality")],
    ["mode", dimensionAdjustment(input.rule.modeDimensions, dimensions.mode, "mode")],
    ["input_type", dimensionAdjustment(input.rule.inputTypeDimensions, dimensions.inputType, "inputType")],
  ];
  for (const [code, adjustment] of adjustments) if (adjustment) total = applyAdjustment(total, adjustment, input.usage, code, lines);

  if (Object.keys(input.rule.formula).length > 0) {
    const kind = input.rule.formula.kind;
    if (typeof kind !== "string") fail("RULE_INVALID", "Pricing formula kind is required.");
    const evaluator = input.formulaEvaluators?.[kind] ?? (kind === "linear" ? linearFormulaEvaluator : undefined);
    if (!evaluator) fail("FORMULA_UNSUPPORTED", `Pricing formula '${kind}' is not registered.`);
    const result = evaluator({ usage: input.usage, dimensions, formula: input.rule.formula });
    const formulaAmount = new Decimal(exactDecimal(result.amount, "formula.result"));
    total = result.operation === "replace" ? formulaAmount : total.plus(formulaAmount);
    line(lines, `formula.${kind}`, new Decimal(1), formulaAmount, formulaAmount);
  }

  const providerCost = total.toFixed() as DecimalString;
  const providerCostUsd = (input.rule.currency === "USD" ? total : total.div(fx)).toFixed() as DecimalString;
  const customerChargeCredits = new Decimal(providerCostUsd).mul(fx).mul(input.rule.markup).toFixed() as DecimalString;
  return {
    providerCost: { amount: providerCost, currency: input.rule.currency },
    providerCostUsd,
    customerChargeCredits,
    breakdown: lines,
    snapshot: {
      pricingRuleId: input.rule.id,
      providerKey: input.rule.providerKey,
      modelId: input.rule.modelId,
      upstreamModel: input.rule.upstreamModel,
      pricingVersion: input.rule.pricingVersion,
      pricingStatus: "verified",
      internalUsdPkrRate: fx,
      markup: input.rule.markup,
      dimensions,
      rates: input.rule.rates,
      formula: input.rule.formula,
      effectiveFrom: input.rule.effectiveFrom,
      effectiveUntil: input.rule.effectiveUntil,
      verifiedAt: input.rule.verifiedAt,
      sourceName: input.rule.sourceName,
      sourceUrl: input.rule.sourceUrl,
    },
  };
}
