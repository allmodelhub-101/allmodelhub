import assert from "node:assert/strict";
import test from "node:test";
import { add, creditsToPkr, creditsToUsd, decimalString, multiply, pkrToCredits, pkrToUsd, usdToCredits, usdToPkr } from "../../src/lib/billing/money.ts";

test("uses exact decimal arithmetic for familiar binary floating-point edge cases", () => {
  assert.equal(add("0.1", "0.2"), "0.3");
  assert.equal(multiply("0.000000000000000001", "0.000000000000000001"), "0.000000000000000000000000000000000001");
});

test("preserves very tiny provider costs", () => {
  assert.equal(usdToPkr("0.000000000000000001", "310.125"), "0.000000000000000310125");
  assert.equal(usdToCredits("0.000000000000000001", "310.125"), "0.000000000000000310125");
});

test("preserves large values without IEEE-754 precision loss", () => {
  const usd = "90071992547409931234567890.123456789";
  assert.equal(usdToPkr(usd, "310.125"), "27933576688765504924120366924.537036688625");
});

test("keeps one Credit equal to one PKR exactly", () => {
  const amount = "12345678901234567890.000000000000000001";
  assert.equal(pkrToCredits(amount), amount);
  assert.equal(creditsToPkr(amount), amount);
});

test("round-trips USD through PKR and Credits at the configured internal rate", () => {
  const usd = "123456789.123456789123456789";
  const rate = "307.777777777777777777";
  assert.equal(pkrToUsd(usdToPkr(usd, rate), rate), usd);
  assert.equal(creditsToUsd(usdToCredits(usd, rate), rate), usd);
});

test("rejects non-decimal inputs and non-positive conversion rates", () => {
  assert.throws(() => decimalString("NaN"), /Invalid decimal value/);
  assert.throws(() => usdToPkr("1", "0"), /greater than zero/);
});
