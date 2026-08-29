# All Model Hub Production Deployment Checklist

## Supplier
- [ ] APIMODELS written commercial SaaS permission received.
- [ ] Haimaker backup terms/permission confirmed.
- [ ] Current model IDs verified.
- [ ] Current supplier prices reconciled.
- [ ] Concurrency/rate limits documented.
- [ ] Volume-discount discussion completed.

## Supabase
- [ ] Migrations applied in order.
- [ ] RLS policies reviewed.
- [ ] Backups enabled.
- [ ] Google OAuth configured.
- [ ] Email confirmation configured.
- [ ] First owner account promoted.

## Vercel
- [ ] All `.env.example` values configured securely.
- [ ] Production domain attached.
- [ ] Preview/production environments separated.
- [ ] Function logs and alerts reviewed.

## Payments
- [ ] Easypaisa details correct.
- [ ] Meezan details correct.
- [ ] Duplicate reference detection tested.
- [ ] Admin proof review tested.
- [ ] Payment approval tested twice to confirm idempotency.

## Wallet
- [ ] Parallel hold test.
- [ ] Parallel capture test.
- [ ] Failed generation release test.
- [ ] Client cancellation test.
- [ ] Insufficient balance test.
- [ ] Spending limit test.
- [ ] Welcome credit abuse test.

## AI
- [ ] Budget tier tested.
- [ ] Balanced tier tested.
- [ ] Premium tier tested.
- [ ] Flagship tier tested.
- [ ] Exact-model selection tested.
- [ ] Auto Best tested.
- [ ] Haimaker mapping/fallback tested.
- [ ] Image jobs tested.
- [ ] Video jobs tested.
- [ ] Audio jobs tested.
- [ ] TTS tested.

## Security
- [ ] No secret is committed to Git.
- [ ] Admin MFA enabled.
- [ ] Upstash rate limits active.
- [ ] Cloudflare WAF configured.
- [ ] File upload limits tested.
- [ ] Service-role key server-only.
- [ ] Callback secret strong and private.

## Legal / support
- [ ] Terms reviewed.
- [ ] Privacy Policy reviewed.
- [ ] Acceptable Use reviewed.
- [ ] Refund policy reviewed.
- [ ] Support email configured.
- [ ] WhatsApp support configured if used.
