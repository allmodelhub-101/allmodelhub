import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedMutation, safeAuthenticatedPath, safeInternalPath } from "../../src/lib/security/request.ts";

test("safeInternalPath accepts local paths and rejects redirect bypasses", () => {
  assert.equal(safeInternalPath("/chat?project=one"), "/chat?project=one");
  assert.equal(safeInternalPath("//evil.example/path"), "/chat");
  assert.equal(safeInternalPath("/\\evil.example"), "/chat");
  assert.equal(safeInternalPath("https://evil.example"), "/chat");
  assert.equal(safeInternalPath("/chat\u0000evil"), "/chat");
});

test("safeAuthenticatedPath defaults to chat and prevents auth redirect loops", () => {
  assert.equal(safeAuthenticatedPath(undefined), "/chat");
  assert.equal(safeAuthenticatedPath("/wallet?tab=history"), "/wallet?tab=history");
  assert.equal(safeAuthenticatedPath("/projects?id=one#details"), "/projects?id=one#details");
  assert.equal(safeAuthenticatedPath("/auth/login?next=/wallet"), "/chat");
  assert.equal(safeAuthenticatedPath("/auth/signup"), "/chat");
  assert.equal(safeAuthenticatedPath("/api/wallet"), "/chat");
  assert.equal(safeAuthenticatedPath("//evil.example/path"), "/chat");
  assert.equal(safeAuthenticatedPath("https://evil.example"), "/chat");
});

test("mutation origin validation blocks cross-site requests", () => {
  const sameOrigin = new Request("https://app.example/api/settings", { method: "PATCH", headers: { origin: "https://app.example", "sec-fetch-site": "same-origin" } });
  const crossSite = new Request("https://app.example/api/settings", { method: "PATCH", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } });
  assert.equal(isTrustedMutation(sameOrigin), true);
  assert.equal(isTrustedMutation(crossSite), false);
});
