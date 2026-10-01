import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/security/request";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const limit = await enforceRateLimit(`login:${requestIp(request)}`, "auth");
    if (limit.unavailable) return NextResponse.json({ error: "Sign-in protection is temporarily unavailable." }, { status: 503 });
    if (!limit.success) return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429 });
    const body = loginSchema.parse(await request.json());
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(body);

    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        return NextResponse.json({ error: "Please confirm your email before signing in.", code: "EMAIL_NOT_CONFIRMED" }, { status: 401 });
      }
      if (/invalid login credentials/i.test(error.message)) {
        return NextResponse.json({ error: "Check your email address and password.", code: "INVALID_CREDENTIALS" }, { status: 401 });
      }
      return NextResponse.json({ error: "Unable to sign in right now.", code: "SIGN_IN_UNAVAILABLE" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 400 });
  }
}
