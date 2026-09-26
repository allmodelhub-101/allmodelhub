import assert from "node:assert/strict";
import test from "node:test";
import { nextReconcileAt, rawProviderTerminalState, reconciliationBackoffMinutes, reconciliationDecision } from "../../src/lib/billing/reconciliation-core.ts";

test("reconciliation backoff starts conservatively and caps at six hours", () => {
  assert.equal(reconciliationBackoffMinutes(0), 5);
  assert.equal(reconciliationBackoffMinutes(1), 10);
  assert.equal(reconciliationBackoffMinutes(4), 80);
  assert.equal(reconciliationBackoffMinutes(20), 360);
  assert.equal(nextReconcileAt(new Date("2026-09-26T00:00:00Z"), 1), "2026-09-26T00:10:00.000Z");
  assert.throws(() => reconciliationBackoffMinutes(-1), TypeError);
});

test("confirmed success settles and processing retains the reservation", () => {
  assert.equal(reconciliationDecision({ providerState: "completed", hasTrustedOutput: true, failureIsNonBillable: true }), "settle");
  assert.equal(reconciliationDecision({ providerState: "processing", hasTrustedOutput: false, failureIsNonBillable: true }), "retain");
  assert.equal(reconciliationDecision({ providerState: "pending", hasTrustedOutput: false, failureIsNonBillable: true }), "retain");
});

test("only contract-confirmed non-billable failures release", () => {
  assert.equal(reconciliationDecision({ providerState: "failed", hasTrustedOutput: false, failureIsNonBillable: true }), "release");
  assert.equal(reconciliationDecision({ providerState: "failed", hasTrustedOutput: false, failureIsNonBillable: false }), "quarantine");
  assert.equal(reconciliationDecision({ providerState: "completed", hasTrustedOutput: false, failureIsNonBillable: true }), "quarantine");
});

test("provider terminal state preserves cancelled and expired outcomes", () => {
  assert.equal(rawProviderTerminalState({ data: { status: "cancelled" } }), "cancelled");
  assert.equal(rawProviderTerminalState({ state: "expired" }), "expired");
  assert.equal(rawProviderTerminalState({ status: "error" }), "failed");
});
