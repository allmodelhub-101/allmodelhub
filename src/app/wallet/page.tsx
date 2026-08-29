import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getWallet } from "@/lib/wallet";
import { createAdminClient } from "@/lib/supabase/admin";
import { WalletClient } from "@/components/wallet-client";

export const dynamic = "force-dynamic";
export default async function WalletPage(){const user=await requireUser();const wallet=await getWallet(user.id);const admin=createAdminClient();const {data:tx}=await admin.from("wallet_transactions").select("id,type,amount,balance_after,reference_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40);return <AppShell><div style={{marginBottom:20}}><div className="kicker">Wallet</div><h1 className="page-title">Credits & billing</h1></div><WalletClient initialWallet={wallet} initialTransactions={tx||[]}/></AppShell>}
