# Provider callback security

APIMODELS callbacks currently use the secret URL route because the provider contract does not expose a signed webhook verification scheme. Keep `CALLBACK_SECRET` as the active secret and optionally set `CALLBACK_SECRET_PREVIOUS` during rotation; deploy the new active secret, then remove the previous value after all providers have switched.

The callback compares secrets with a constant-time comparison, rejects oversized payloads, validates the task schema, and uses an atomic `submitted`/`processing` to `settling` claim so retries cannot settle the same task twice. Do not log callback URLs, secrets, authorization headers, or full provider payloads.
