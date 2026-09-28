export type ReconciliationOutcome = "processing" | "quarantined" | "resolved";

export function reconciliationBackoffMinutes(attempts: number) {
  if (!Number.isInteger(attempts) || attempts < 0) throw new TypeError("Reconciliation attempts must be a non-negative integer.");
  return Math.min(360, Math.max(5, 5 * (2 ** Math.min(attempts, 7))));
}

export function nextReconcileAt(now: Date, attempts: number) {
  return new Date(now.getTime() + reconciliationBackoffMinutes(attempts) * 60_000).toISOString();
}

export function rawProviderTerminalState(raw: unknown): "failed" | "cancelled" | "expired" {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const state = String(data.state ?? data.status ?? root.state ?? root.status ?? "failed").toLowerCase();
  if (state === "cancelled" || state === "canceled") return "cancelled";
  if (state === "expired") return "expired";
  return "failed";
}

export function reconciliationDecision(input: Readonly<{
  providerState: "pending" | "processing" | "completed" | "failed";
  hasTrustedOutput: boolean;
  failureIsNonBillable: boolean;
}>) {
  if (input.providerState === "completed") return input.hasTrustedOutput ? "settle" : "quarantine" as const;
  if (input.providerState === "failed") return input.failureIsNonBillable ? "release" : "quarantine" as const;
  return "retain" as const;
}
