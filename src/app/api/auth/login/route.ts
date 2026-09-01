import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(body);

    if (error) {
      const message = /email not confirmed/i.test(error.message)
        ? "Please confirm your email before signing in."
        : /invalid login credentials/i.test(error.message)
          ? "Invalid email or password."
          : "Unable to sign in right now.";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 400 });
  }
}
