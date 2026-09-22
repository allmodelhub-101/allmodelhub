# Provider callback security

APIMODELS callbacks currently use the secret URL route because the provider contract does not expose a signed webhook verification scheme. Keep `CALLBACK_SECRET` as the active secret and optionally set `CALLBACK_SECRET_PREVIOUS` during rotation; deploy the new active secret, then remove the previous value after all providers have switched.

The callback compares secrets with a constant-time comparison, enforces a 256 KiB body limit even when `Content-Length` is missing, validates the task schema, rate-limits sources, and uses an atomic `submitted`/`processing` to `settling` claim so retries cannot settle the same task twice. Do not log callback URLs, secrets, authorization headers, task IDs, signed URLs, or full provider payloads.

Every output URL must be HTTPS and match `PROVIDER_ASSET_HOST_ALLOWLIST`. Each hostname is resolved before fetch and rejected if any result is private/link-local/loopback. Redirects are revalidated, MIME types are allowlisted, and the response body is streamed through a 250 MiB ceiling. Configure exact provider/CDN hostnames in staging; never use a broad suffix solely to make a callback pass.
