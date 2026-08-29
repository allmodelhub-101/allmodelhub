import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic="force-dynamic";

export default async function UsagePage(){
  const user=await requireUser();const admin=createAdminClient();
  const [{data:tx},{data:messages},{data:jobs}]=await Promise.all([
    admin.from("wallet_transactions").select("id,type,amount,balance_after,reference_id,metadata,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
    admin.from("messages").select("id,model_id,provider_key,input_tokens,output_tokens,credits_charged,created_at").eq("user_id",user.id).eq("role","assistant").not("credits_charged","is",null).order("created_at",{ascending:false}).limit(50),
    admin.from("generation_jobs").select("id,public_id,modality,model_id,status,charged_credits,estimated_credits,created_at,completed_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50)
  ]);
  const spent=(tx||[]).filter(x=>x.type==="generation_capture").reduce((a,x)=>a+Math.abs(Number(x.amount)),0);
  return <AppShell><div className="page-head"><div><div className="kicker">Usage & receipts</div><h1 className="page-title">Every credit is traceable.</h1><p className="muted">Text and media receipts show what you used and what All Model Hub charged, without exposing wholesale supplier costs.</p></div></div>
    <div className="stats-grid usage-stats"><div className="card stat-card"><span>AI spend</span><strong>{spent.toFixed(2)}</strong><div className="muted small">Credits</div></div><div className="card stat-card"><span>Text receipts</span><strong>{messages?.length||0}</strong></div><div className="card stat-card"><span>Media jobs</span><strong>{jobs?.length||0}</strong></div><div className="card stat-card"><span>Credit value</span><strong>₨1</strong><div className="muted small">per Credit</div></div></div>
    <section className="card panel-block"><h2>Text generation receipts</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Model</th><th>Provider</th><th>Input</th><th>Output</th><th>Charged</th></tr></thead><tbody>{messages?.length?messages.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.model_id}</td><td>{r.provider_key||"—"}</td><td>{r.input_tokens??"—"}</td><td>{r.output_tokens??"—"}</td><td>{Number(r.credits_charged||0).toFixed(4)} Credits</td></tr>):<tr><td colSpan={6}>No text receipts yet.</td></tr>}</tbody></table></div></section>
    <section className="card panel-block"><h2>Media generation receipts</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Model</th><th>Status</th><th>Charged</th></tr></thead><tbody>{jobs?.length?jobs.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.public_id}</td><td>{r.modality}</td><td>{r.model_id}</td><td><span className="badge">{r.status}</span></td><td>{Number(r.charged_credits||0).toFixed(2)} Credits</td></tr>):<tr><td colSpan={6}>No media receipts yet.</td></tr>}</tbody></table></div></section>
    <section className="card panel-block"><h2>Wallet ledger</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Reference</th></tr></thead><tbody>{tx?.length?tx.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.type}</td><td className={Number(r.amount)<0?"negative":"positive"}>{Number(r.amount).toFixed(4)}</td><td>{r.balance_after==null?"—":Number(r.balance_after).toFixed(4)}</td><td>{r.reference_id||"—"}</td></tr>):<tr><td colSpan={5}>No ledger entries yet.</td></tr>}</tbody></table></div></section>
  </AppShell>
}
