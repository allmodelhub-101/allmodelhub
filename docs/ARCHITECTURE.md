# Architecture

Browser → Next.js UI → authenticated Route Handler → spending/wallet check → AMH router → provider adapter → upstream API.

For async media: UI → quote/confirmation → wallet hold → `generation_jobs` → APIMODELS task → callback/poll → capture/release → result.

For manual payments: order/proof → private Supabase Storage → admin verification → idempotent `approve_manual_payment()` RPC → purchased wallet credit.

Provider credentials and Supabase service-role credentials are server-only.
