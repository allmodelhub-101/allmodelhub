import { looksDisposable } from "@/lib/disposable-email";
import { ensureProfile } from "@/lib/user-profile";
import { grantWelcomeCredits } from "@/lib/wallet";
import { getWelcomeCredits } from "@/lib/system-settings";

export async function provisionAuthenticatedUser(user: { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> }) {
  await ensureProfile(user);
  if (user.email_confirmed_at && !looksDisposable(user.email)) {
    const welcomeCredits = await getWelcomeCredits();
    if (welcomeCredits > 0) await grantWelcomeCredits(user.id, welcomeCredits).catch(() => undefined);
  }
}
