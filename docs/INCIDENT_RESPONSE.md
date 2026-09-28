# Incident response runbook

## Priorities

Protect customer data and wallet integrity first, preserve evidence second, restore service safely third. Do not delete logs or mutate disputed ledger rows during triage.

## Immediate response (first 15 minutes)

1. Declare an incident owner and start a timestamped incident record.
2. Disable the affected feature through existing feature flags, or pause the production deployment if scope is unknown.
3. For suspected credential exposure, rotate the affected provider/service key. For callbacks, set a new `CALLBACK_SECRET`, temporarily retain the previous value only while updating the provider, then remove it.
4. For payment/wallet anomalies, disable generation/payment entry points; do not manually edit balances. Preserve job, hold, transaction, payment and audit IDs.
5. For account compromise, revoke sessions in Supabase Auth and protect the owner/admin accounts first.

## Evidence to preserve

- Vercel request/function logs and deployment IDs.
- Supabase Auth, Postgres and storage audit/security logs.
- `audit_logs`, relevant `generation_jobs`, `wallet_holds`, `wallet_transactions`, `manual_payments` and notification records.
- Provider request/task references held server-side. Never paste callback secrets, Authorization headers, signed URLs or proof files into the incident channel.

## Containment playbooks

### Callback abuse or SSRF attempt

- Rotate callback secret; remove the previous secret after provider cutover.
- Narrow `PROVIDER_ASSET_HOST_ALLOWLIST`; block observed sources at the platform firewall.
- Identify jobs stuck in `settling`; use the admin reconciliation endpoint only after verifying provider state.
- Confirm no private destination was contacted and no untrusted output was stored.

### Wallet/payment inconsistency

- Pause billable generation and manual approval.
- Compare holds and ledger entries by idempotency key; never issue a compensating credit until the immutable evidence is reconciled.
- Use reviewed, idempotent RPC/forward migration for corrections and record the action in `audit_logs`.

### Secret or service-role exposure

- Rotate immediately in Supabase/provider/Upstash, update Preview then Production, revoke the old value, and redeploy.
- Search Git history and CI/deployment logs by secret *name/fingerprint*, not by printing the full value.
- Review admin actions and database access during the exposure window.

### Malicious upload

- Disable upload entry points, quarantine the private object, preserve its hash/metadata, and review access logs.
- Do not download or open the file on an unmanaged workstation.
- Add its confirmed signature/type to validation or scanning controls before re-enabling uploads.

## Recovery and closure

1. Restore in staging/Preview, run the security checklist and then promote.
2. Monitor error, denial, callback and financial reconciliation metrics.
3. Notify affected users/regulators according to legal obligations and verified impact—avoid speculation.
4. Publish a blameless post-incident review with root cause, detection gap, timeline, customer impact, corrective actions and named owners/dates.
