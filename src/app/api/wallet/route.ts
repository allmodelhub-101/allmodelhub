import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const wallet = await getWallet(data.user.id);
  const admin = createAdminClient();
  const { data: transactions } = await admin.from("wallet_transactions").select("id,type,bucket,amount,reference_id,balance_after,created_at,metadata").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ wallet, transactions: transactions ?? [] });
}
