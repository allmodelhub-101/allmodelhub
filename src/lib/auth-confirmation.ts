import type { EmailOtpType } from "@supabase/supabase-js";

const SIGNUP_CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup"]);

export function parseSignupConfirmationType(value: string | null): EmailOtpType | null {
  if (!value || !SIGNUP_CONFIRMATION_TYPES.has(value as EmailOtpType)) return null;
  return value as EmailOtpType;
}

export const EMAIL_VERIFIED_COOKIE = "models-suite-email-verified";

