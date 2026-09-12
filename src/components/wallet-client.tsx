"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bank, CheckCircle, Clock, CreditCard, Receipt, ShieldCheck, UploadSimple } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";

type Method = { id:string; label:string; accountTitle:string; accountNumber:string; iban?:string; instructions:string };
type Wallet = { available: number; purchased: number; promo: number; reserved: number };
type Transaction = { id: string; created_at: string; type: string; amount: number; balance_after?: number | null; reference_id?: string | null };

export function WalletClient({ initialWallet, initialTransactions }: { initialWallet: Wallet; initialTransactions: Transaction[] }) {
  const [wallet,setWallet] = useState(initialWallet);
  const [transactions,setTransactions] = useState(initialTransactions);
  const [methods,setMethods] = useState<Method[]>([]);
  const [method,setMethod] = useState("easypaisa");
  const [amount,setAmount] = useState(1000);
  const [reference,setReference] = useState("");
  const [proof,setProof] = useState<File|null>(null);
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);

  useEffect(()=>{fetch("/api/payments/manual").then(r=>r.json()).then(d=>setMethods(d.methods||[])).catch(()=>undefined)},[]);
  const selected = methods.find(m=>m.id===method);

  async function refresh(){const r=await fetch("/api/wallet");if(r.ok){const d=await r.json();setWallet(d.wallet);setTransactions(d.transactions||[])}}
  async function submit(e:FormEvent){e.preventDefault();if(!proof)return setStatus("Upload payment proof first.");setBusy(true);setStatus("");const fd=new FormData();fd.append("method",method);fd.append("amount",String(amount));fd.append("transactionReference",reference);fd.append("proof",proof);const r=await fetch("/api/payments/manual",{method:"POST",body:fd});const d=await r.json().catch(()=>({}));setBusy(false);if(!r.ok)return setStatus(d.error||"Could not submit payment.");setStatus(`Submitted ${d.payment.public_id}. Verification is pending.`);setReference("");setProof(null);await refresh();}

  const walletCards=[{label:"Available",value:wallet.available,detail:"Ready to use",icon:CreditCard,primary:true},{label:"Purchased",value:wallet.purchased,detail:"Never expires",icon:CheckCircle},{label:"Promotional",value:wallet.promo,detail:"Tracked separately",icon:Receipt},{label:"Reserved",value:wallet.reserved,detail:"Held for active jobs",icon:Clock}];
  return <div className="wallet-workspace">
    <section className="wallet-balance-grid" aria-label="Wallet balances">{walletCards.map(card=>{const Icon=card.icon;return <div className={`card wallet-balance-card ${card.primary?"is-primary":""}`} key={card.label}><span className="wallet-balance-icon"><Icon weight="fill" aria-hidden="true" /></span><span className="wallet-balance-label">{card.label}</span><strong>{Number(card.value).toFixed(2)}</strong><small>{card.detail}</small></div>})}</section>
    <div className="studio-layout wallet-studio-layout">
      <section className="card studio-panel wallet-topup-panel"><div className="wallet-section-heading"><span className="wallet-section-icon"><Bank weight="fill" aria-hidden="true" /></span><span><span className="kicker">Add credits</span><h2>Manual top-up</h2></span></div><p className="muted small">1 Credit = PKR 1. Minimum top-up is PKR 500. Credits are added only after payment proof is reviewed.</p>
        <form onSubmit={submit} style={{display:"grid",gap:13,marginTop:18}}>
          <label className="label">Amount (PKR)<input className="input" type="number" min={500} step={100} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
          <label className="label">Payment method<PremiumSelect value={method} onChange={setMethod} options={[{value:"easypaisa",label:"Easypaisa"},{value:"meezan",label:"Meezan Bank"}]} /></label>
          {selected&&<div className="soft-card" style={{padding:14,lineHeight:1.65}}><b>{selected.label}</b><div className="muted small">Account title: {selected.accountTitle}</div><div className="muted small">Account: {selected.accountNumber}</div>{selected.iban&&<div className="muted small">IBAN: {selected.iban}</div>}<div className="small" style={{marginTop:8}}>{selected.instructions}</div></div>}
          <label className="label">Transaction / reference ID<input className="input" value={reference} onChange={e=>setReference(e.target.value)} required minLength={4}/></label>
          <label className="label">Payment proof<input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} required/></label>
          <button className="btn btn-primary wallet-submit" disabled={busy}><UploadSimple weight="bold" aria-hidden="true" />{busy?"Submitting…":`Submit PKR ${amount.toLocaleString()} payment`}</button>
          {status&&<div className="soft-card small wallet-status" style={{padding:12}}>{status}</div>}
        </form>
      </section>
      <section className="card studio-panel wallet-protection-panel"><div className="wallet-section-heading"><span className="wallet-section-icon"><ShieldCheck weight="fill" aria-hidden="true" /></span><span><span className="kicker">Wallet protection</span><h2>Transparent by design.</h2></span></div><div className="wallet-protection-list"><div className="soft-card"><b>Purchased credits never expire</b><div className="muted small">Promotional credits stay separate from paid balance.</div></div><div className="soft-card"><b>Expensive jobs reserve first</b><div className="muted small">Media generation can’t silently push your wallet negative.</div></div><div className="soft-card"><b>Every charge has a ledger record</b><div className="muted small">No arbitrary hidden balance editing.</div></div></div></section>
    </div>
    <section className="wallet-ledger"><div className="wallet-ledger-heading"><span><Receipt weight="fill" aria-hidden="true" /><span><span className="kicker">Receipts</span><h2 className="page-title">Recent transactions</h2></span></span><small>Every movement is recorded</small></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Reference</th></tr></thead><tbody>{transactions.length?transactions.map((t: Transaction)=><tr key={t.id}><td>{new Date(t.created_at).toLocaleString()}</td><td>{t.type}</td><td style={{color:Number(t.amount)>=0?"var(--success)":"var(--text)"}}>{Number(t.amount)>=0?"+":""}{Number(t.amount).toFixed(4)}</td><td>{t.balance_after==null?"—":Number(t.balance_after).toFixed(4)}</td><td>{t.reference_id||"—"}</td></tr>):<tr><td colSpan={5} className="muted">No transactions yet.</td></tr>}</tbody></table></div></section>
  </div>;
}

