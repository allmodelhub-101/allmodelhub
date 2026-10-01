import assert from "node:assert/strict";
import test from "node:test";
import { parseSignupConfirmationType } from "../../src/lib/auth-confirmation.ts";

test("signup confirmation accepts only email verification OTP types", () => {
  assert.equal(parseSignupConfirmationType("email"), "email");
  assert.equal(parseSignupConfirmationType("signup"), "signup");
  assert.equal(parseSignupConfirmationType("recovery"), null);
  assert.equal(parseSignupConfirmationType("magiclink"), null);
  assert.equal(parseSignupConfirmationType(null), null);
});
