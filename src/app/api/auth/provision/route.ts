import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionAuthenticatedUser } from "@/lib/auth-provision";

export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  await provisionAuthenticatedUser(data.user);
  return NextResponse.json({ ok: true });
}
