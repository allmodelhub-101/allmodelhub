"use client";

import { FormEvent, useMemo, useState } from "react";
import { PremiumSelect } from "@/components/premium-select";
import { Activity, ArrowRight, ChartLineUp, CheckCircle, Clock, Coins, CreditCard, Gauge, UsersThree, WarningCircle } from "@phosphor-icons/react";

type Payment = {
  id: string; public_id: string; method: string; amount_pkr: number; credits: number; status: string;
  bonus_percent: number; bonus_credits: number;
  transaction_reference: string; proofUrl?: string; created_at: string; email?: string | null;
};
type Model = {
  id: string; display_name: string; tier: string; modality: string; markup: number; active: boolean;
  featured: boolean; auto_eligible: boolean; provider_family: string; upstream_model: string;
};
type UserRow = {
  id: string; email?: string | null; display_name?: string | null; role: string; created_at: string;
  welcome_granted_at?: string | null;
  wallet?: { purchased_balance: number; promo_balance: number; reserved_balance: number } | null;
};
type ProviderRoute = {
  id: string; model_id: string; provider_key: "apimodels" | "haimaker"; upstream_model: string; priority: number; active: boolean;
};
type Job = {
  id: string; public_id: string; email?: string | null; modality: string; model_id: string; provider_key?: string | null;
  status: string; charged_credits: number; error_message?: string | null; created_at: string;
};
type Ticket = {
  id: string; public_id: string; email?: string | null; category: string; subject: string; status: string; priority: string; updated_at: string;
};
export type AdminTab = "overview" | "payments" | "models" | "providers" | "users" | "jobs" | "support" | "settings";
type FeatureFlags = Record<"audio_studio" | "image_studio" | "model_battle" | "private_chat" | "prompt_enhancer" | "teams" | "video_studio", boolean>;
type ProfitSummary = { chatRevenue: number; chatCost: number; mediaRevenue: number; mediaCost: number };

export function AdminClient(props: {
  payments: Payment[]; models: Model[]; users: UserRow[]; routes: ProviderRoute[]; jobs: Job[]; tickets: Ticket[];
  settings: Record<string, number>; features: FeatureFlags; initialTab?: AdminTab;
  profitSummary: ProfitSummary;
}) {
  const [tab, setTab] = useState<AdminTab>(props.initialTab ?? "overview");
  const [payments, setPayments] = useState(props.payments);
  const [models, setModels] = useState(props.models);
  const [routes, setRoutes] = useState(props.routes);
  const [users, setUsers] = useState(props.users);
  const [tickets, setTickets] = useState(props.tickets);
  const [jobs, setJobs] = useState(props.jobs);
  const [status, setStatus] = useState("");
  const [platformSettings, setPlatformSettings] = useState(props.settings);
  const [featureFlags, setFeatureFlags] = useState(props.features);
  const [newRouteModel, setNewRouteModel] = useState(props.models[0]?.id ?? "");
  const [newRouteProvider, setNewRouteProvider] = useState<"apimodels" | "haimaker">("apimodels");
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.email ?? ""} ${user.display_name ?? ""} ${user.id}`.toLowerCase().includes(needle));
  }, [users, query]);

  async function paymentAction(id: string, action: "approve" | "reject") {
    setStatus("Working…");
    const response = await fetch(`/api/admin/payments/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: action === "reject" ? "Could not verify payment proof." : "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Action failed");
    setPayments((items) => items.map((payment) => payment.id === id ? { ...payment, status: action === "approve" ? "approved" : "rejected" } : payment));
    setStatus(`Payment ${action === "approve" ? "approved" : "rejected"}.`);
  }

  async function updateModel(id: string, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Model update failed");
    setModels((items) => items.map((model) => model.id === id ? { ...model, ...data.model } : model));
    setStatus("Model updated.");
  }

  async function saveProviderRoute(route: ProviderRoute, patch: Partial<ProviderRoute>) {
    const next = { ...route, ...patch };
    const response = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: next.model_id, providerKey: next.provider_key, upstreamModel: next.upstream_model, priority: Number(next.priority), active: next.active })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Provider route update failed");
    setRoutes((items) => {
      const exists = items.some((item) => item.model_id === data.route.model_id && item.provider_key === data.route.provider_key);
      return exists ? items.map((item) => item.model_id === data.route.model_id && item.provider_key === data.route.provider_key ? data.route : item) : [...items, data.route];
    });
    setStatus("Provider route updated.");
  }

  async function createProviderRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      modelId: String(form.get("modelId") || ""), providerKey: String(form.get("providerKey") || "apimodels"),
      upstreamModel: String(form.get("upstreamModel") || ""), priority: Number(form.get("priority") || 100), active: true
    };
    const response = await fetch("/api/admin/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Could not create route");
    setRoutes((items) => [...items.filter((item) => !(item.model_id === data.route.model_id && item.provider_key === data.route.provider_key)), data.route]);
    event.currentTarget.reset();
    setStatus("Provider route saved.");
  }

  async function addCredit(userId: string) {
    const raw = window.prompt("Credits to add (positive number):", "10");
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return setStatus("Enter a valid positive credit amount.");
    const note = window.prompt("Reason for this adjustment:", "Customer support adjustment");
    if (!note) return;
    const bucket = window.confirm("OK = purchased credits, Cancel = promotional credits") ? "purchased" : "promo";
    const response = await fetch(`/api/admin/users/${userId}/credit`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, bucket, note })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Adjustment failed");
    setUsers((items) => items.map((user) => {
      if (user.id !== userId || !user.wallet) return user;
      return { ...user, wallet: { ...user.wallet, [bucket === "purchased" ? "purchased_balance" : "promo_balance"]: Number(user.wallet[bucket === "purchased" ? "purchased_balance" : "promo_balance"] || 0) + amount } };
    }));
    setStatus("Wallet adjusted and audited.");
  }


  async function savePlatformSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      internalUsdPkr: Number(form.get("internalUsdPkr")),
      minTopupPkr: Number(form.get("minTopupPkr")),
      welcomeCredits: Number(form.get("welcomeCredits")),
      features: featureFlags
    };
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Platform settings update failed");
    setPlatformSettings({ internal_usd_pkr: payload.internalUsdPkr, min_topup_pkr: payload.minTopupPkr, welcome_credits: payload.welcomeCredits });
    setStatus("Platform settings updated. New pricing/top-up operations use these values immediately.");
  }

  async function replyTicket(ticket: Ticket) {
    const message = window.prompt(`Reply to ${ticket.public_id}:`);
    if (!message?.trim()) return;
    const response = await fetch(`/api/admin/support/${ticket.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim(), status: "waiting_user" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Reply failed");
    setTickets((items) => items.map((item) => item.id === ticket.id ? { ...item, status: "waiting_user", updated_at: new Date().toISOString() } : item));
    setStatus("Support reply sent.");
  }

  async function reconcileJob(job: Job) {
    setStatus(`Checking ${job.public_id} with its provider…`);
    const response = await fetch(`/api/admin/jobs/${job.id}/reconcile`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error || "Job reconciliation failed");
    if (data.job) setJobs((items) => items.map((item) => item.id === job.id ? { ...item, ...data.job } : item));
    setStatus(data.message || `${job.public_id} reconciled.`);
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" }, { id: "payments", label: "Payments" }, { id: "models", label: "Models" }, { id: "providers", label: "Providers" },
    { id: "users", label: "Users" }, { id: "jobs", label: "Jobs" }, { id: "support", label: "Support" }, { id: "settings", label: "Platform" }
  ];

  return <div className="admin-console">
    <div className="admin-tabs">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {status && <div className="soft-card small" style={{ padding: 12 }}>{status}</div>}
    {tab === "overview" && <AdminOverview payments={payments} users={users} models={models} routes={routes} jobs={jobs} tickets={tickets} profitSummary={props.profitSummary} openTab={setTab} />}

    {tab === "payments" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Manual payments</h2><div className="table-wrap"><table><thead><tr><th>Order</th><th>User</th><th>Method</th><th>Credit breakdown</th><th>Reference</th><th>Status</th><th>Proof</th><th>Action</th></tr></thead><tbody>{payments.length ? payments.map((payment) => <tr key={payment.id}><td>{payment.public_id}</td><td>{payment.email || "—"}</td><td>{payment.method}</td><td><b>Paid: PKR {Number(payment.amount_pkr).toLocaleString()}</b><div className="muted small">Purchased {Number(payment.credits).toLocaleString()} · Bonus +{Number(payment.bonus_credits || 0).toLocaleString()} promo</div><div className="small">Total {(Number(payment.credits) + Number(payment.bonus_credits || 0)).toLocaleString()}</div></td><td>{payment.transaction_reference}</td><td><span className={`badge ${payment.status === "approved" ? "success" : payment.status === "rejected" ? "danger" : "warning"}`}>{payment.status}</span></td><td>{payment.proofUrl ? <a className="btn btn-ghost" href={payment.proofUrl} target="_blank" rel="noreferrer">View ↗</a> : "—"}</td><td>{!["approved", "rejected", "duplicate", "cancelled"].includes(payment.status) ? <div style={{ display: "flex", gap: 6 }}><button className="btn btn-primary" onClick={() => paymentAction(payment.id, "approve")}>Approve</button><button className="btn btn-danger" onClick={() => paymentAction(payment.id, "reject")}>Reject</button></div> : "—"}</td></tr>) : <tr><td colSpan={8} className="muted">No payment submissions.</td></tr>}</tbody></table></div></section>}

    {tab === "models" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Model controls</h2><div className="table-wrap"><table><thead><tr><th>Model</th><th>Tier</th><th>Type</th><th>Provider family</th><th>Markup</th><th>Auto</th><th>Active</th></tr></thead><tbody>{models.map((model) => <tr key={model.id}><td><b>{model.display_name}</b><div className="muted small">{model.id}</div></td><td>{model.tier}</td><td>{model.modality}</td><td>{model.provider_family}</td><td><input className="input" style={{ width: 90, padding: 7 }} type="number" min={1} max={20} step={0.05} defaultValue={Number(model.markup)} onBlur={(event) => updateModel(model.id, { markup: Number(event.target.value) })} /></td><td><button className={`btn ${model.auto_eligible ? "btn-primary" : ""}`} onClick={() => updateModel(model.id, { autoEligible: !model.auto_eligible })}>{model.auto_eligible ? "Eligible" : "Excluded"}</button></td><td><button className={`btn ${model.active ? "btn-primary" : ""}`} onClick={() => updateModel(model.id, { active: !model.active })}>{model.active ? "Active" : "Disabled"}</button></td></tr>)}</tbody></table></div></section>}

    {tab === "providers" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Provider routing</h2><form className="card studio-panel" onSubmit={createProviderRoute} style={{ marginBottom: 14 }}><div className="form-grid"><label className="label">AMH model<PremiumSelect value={newRouteModel} onChange={setNewRouteModel} options={models.map((model) => ({ value: model.id, label: model.display_name }))} /></label><label className="label">Provider<PremiumSelect value={newRouteProvider} onChange={(value) => setNewRouteProvider(value as "apimodels" | "haimaker")} options={[{ value: "apimodels", label: "APIMODELS" }, { value: "haimaker", label: "Haimaker" }]} /></label><input type="hidden" name="modelId" value={newRouteModel} /><input type="hidden" name="providerKey" value={newRouteProvider} /><label className="label">Upstream model<input className="input" name="upstreamModel" required /></label><label className="label">Priority<input className="input" name="priority" type="number" defaultValue={100} min={1} max={1000} /></label></div><button className="btn btn-primary" type="submit">Add / update route</button></form><div className="table-wrap"><table><thead><tr><th>AMH model</th><th>Provider</th><th>Upstream model</th><th>Priority</th><th>Status</th></tr></thead><tbody>{routes.length ? routes.map((route) => <tr key={`${route.model_id}:${route.provider_key}`}><td>{route.model_id}</td><td>{route.provider_key}</td><td><input className="input" style={{ minWidth: 210, padding: 7 }} defaultValue={route.upstream_model} onBlur={(event) => saveProviderRoute(route, { upstream_model: event.target.value })} /></td><td><input className="input" style={{ width: 80, padding: 7 }} type="number" min={1} max={1000} defaultValue={route.priority} onBlur={(event) => saveProviderRoute(route, { priority: Number(event.target.value) })} /></td><td><button className={`btn ${route.active ? "btn-primary" : ""}`} onClick={() => saveProviderRoute(route, { active: !route.active })}>{route.active ? "Active" : "Disabled"}</button></td></tr>) : <tr><td colSpan={5} className="muted">No provider routes configured.</td></tr>}</tbody></table></div></section>}

    {tab === "users" && <section><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", marginBottom: 14 }}><div><h2 className="page-title">Users & wallets</h2><p className="muted small">Admin credit actions are written to the wallet ledger and audit log.</p></div><input className="input" style={{ maxWidth: 330 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, name, or user ID" /></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Purchased</th><th>Promo</th><th>Reserved</th><th>Welcome</th><th>Action</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td><b>{user.email || user.display_name || "User"}</b><div className="muted small">{user.id}</div></td><td>{user.role}</td><td>{Number(user.wallet?.purchased_balance ?? 0).toFixed(2)}</td><td>{Number(user.wallet?.promo_balance ?? 0).toFixed(2)}</td><td>{Number(user.wallet?.reserved_balance ?? 0).toFixed(2)}</td><td>{user.welcome_granted_at ? "Granted" : "Not granted"}</td><td><button className="btn" onClick={() => addCredit(user.id)}>Adjust +</button></td></tr>)}</tbody></table></div></section>}

    {tab === "jobs" && <section><h2 className="page-title" style={{ marginBottom: 6 }}>Generation jobs</h2><p className="muted small" style={{ marginBottom: 14 }}>Reconcile checks the provider before it captures or releases a hold. It never guesses the outcome of an ambiguous job.</p><div className="table-wrap"><table><thead><tr><th>Job</th><th>User</th><th>Type</th><th>Model</th><th>Provider</th><th>Status</th><th>Charged</th><th>Error</th><th>Action</th></tr></thead><tbody>{jobs.length ? jobs.map((job) => <tr key={job.id}><td>{job.public_id}</td><td>{job.email || "—"}</td><td>{job.modality}</td><td>{job.model_id}</td><td>{job.provider_key || "—"}</td><td><span className={`badge ${job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}`}>{job.status}</span></td><td>{Number(job.charged_credits ?? 0).toFixed(2)}</td><td className="small">{job.error_message || "—"}</td><td>{!["completed", "failed", "cancelled", "expired"].includes(job.status) ? <button className="btn" onClick={() => reconcileJob(job)}>Reconcile</button> : "—"}</td></tr>) : <tr><td colSpan={9} className="muted">No media jobs yet.</td></tr>}</tbody></table></div></section>}

    {tab === "support" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Support queue</h2><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>User</th><th>Category</th><th>Subject</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{tickets.length ? tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.public_id}</td><td>{ticket.email || "—"}</td><td>{ticket.category}</td><td>{ticket.subject}</td><td>{ticket.status}</td><td>{new Date(ticket.updated_at).toLocaleString()}</td><td><button className="btn btn-primary" onClick={() => replyTicket(ticket)}>Reply</button></td></tr>) : <tr><td colSpan={7} className="muted">No tickets.</td></tr>}</tbody></table></div></section>}

    {tab === "settings" && <section><h2 className="page-title" style={{ marginBottom: 6 }}>Platform controls</h2><p className="muted" style={{ marginBottom: 14 }}>Economics and feature availability are enforced server-side. Supplier acquisition costs remain hidden from customers.</p><form className="card studio-panel" onSubmit={savePlatformSettings}><div className="form-grid"><label className="label">Internal USD → PKR basis<input className="input" name="internalUsdPkr" type="number" min={1} step={0.01} defaultValue={platformSettings.internal_usd_pkr ?? 310} /></label><label className="label">Minimum top-up (PKR)<input className="input" name="minTopupPkr" type="number" min={1} step={1} defaultValue={platformSettings.min_topup_pkr ?? 500} /></label><label className="label">Welcome promotional credits<input className="input" name="welcomeCredits" type="number" min={0} step={1} defaultValue={platformSettings.welcome_credits ?? 10} /></label></div><h3 style={{ margin: "8px 0 0" }}>Feature flags</h3><div className="form-grid">{Object.entries(featureFlags).map(([key, enabled]) => <label className="label" key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={enabled} onChange={(event) => setFeatureFlags((current) => ({ ...current, [key]: event.target.checked }))} />{key.replaceAll("_", " ")}</label>)}</div><button className="btn btn-primary" type="submit">Save platform controls</button></form></section>}
  </div>;
}

function AdminOverview({payments,users,models,routes,jobs,tickets,profitSummary,openTab}:{payments:Payment[];users:UserRow[];models:Model[];routes:ProviderRoute[];jobs:Job[];tickets:Ticket[];profitSummary:ProfitSummary;openTab:(tab:AdminTab)=>void}) {
  const now=Date.now(),day=86400000,approved=payments.filter(p=>p.status==="approved");
  const revenue30=approved.filter(p=>now-new Date(p.created_at).getTime()<=30*day).reduce((s,p)=>s+p.amount_pkr,0);
  const spend30=jobs.filter(j=>now-new Date(j.created_at).getTime()<=30*day).reduce((s,j)=>s+Number(j.charged_credits||0),0);
  const pending=payments.filter(p=>!["approved","rejected","duplicate","cancelled"].includes(p.status)),active=jobs.filter(j=>!["completed","failed","cancelled","expired"].includes(j.status)),failed=jobs.filter(j=>j.status==="failed"&&now-new Date(j.created_at).getTime()<=7*day),open=tickets.filter(t=>!["closed","resolved"].includes(t.status));
  const liability=users.reduce((s,u)=>s+Number(u.wallet?.purchased_balance||0)+Number(u.wallet?.promo_balance||0),0);
  const days=Array.from({length:14},(_,i)=>{const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-(13-i));const end=start.getTime()+day;return{label:start.toLocaleDateString(undefined,{month:"short",day:"numeric"}),value:approved.filter(p=>{const t=new Date(p.created_at).getTime();return t>=start.getTime()&&t<end}).reduce((s,p)=>s+p.amount_pkr,0)}}),max=Math.max(1,...days.map(d=>d.value));
  const usageRevenue=profitSummary.chatRevenue+profitSummary.mediaRevenue,providerCost=profitSummary.chatCost+profitSummary.mediaCost,grossProfit=usageRevenue-providerCost,margin=usageRevenue>0?grossProfit/usageRevenue*100:0;
  const metrics=[{label:"Realized gross profit · 30 days",value:`PKR ${grossProfit.toLocaleString(undefined,{maximumFractionDigits:2})}`,note:`${margin.toFixed(1)}% margin after API cost`,icon:ChartLineUp,tone:"green"},{label:"Usage revenue · 30 days",value:`PKR ${usageRevenue.toLocaleString(undefined,{maximumFractionDigits:2})}`,note:"Credits consumed on completed output",icon:Coins,tone:"cyan"},{label:"Provider cost · 30 days",value:`PKR ${providerCost.toLocaleString(undefined,{maximumFractionDigits:2})}`,note:"Internal API acquisition cost",icon:Gauge,tone:"violet"},{label:"Cash received · 30 days",value:`PKR ${revenue30.toLocaleString()}`,note:"Approved manual top-ups",icon:CreditCard,tone:"amber"}];
  return <section className="admin-overview"><header className="admin-page-head"><div><span className="kicker">Live operations</span><h1>Platform overview</h1><p>Revenue, usage, customer activity, and operational health in one place.</p></div><span className="admin-live"><i/>Live data</span></header>
  <div className="admin-metric-grid">{metrics.map(m=>{const Icon=m.icon;return <article className={`admin-metric ${m.tone}`} key={m.label}><span><Icon weight="duotone"/></span><small>{m.label}</small><strong>{m.value}</strong><p>{m.note}</p></article>})}</div>
  <div className="admin-profit-breakdown"><span><small>Chat profit</small><b>PKR {(profitSummary.chatRevenue-profitSummary.chatCost).toLocaleString(undefined,{maximumFractionDigits:2})}</b><em>{profitSummary.chatRevenue.toFixed(2)} revenue − {profitSummary.chatCost.toFixed(2)} cost</em></span><span><small>Media profit</small><b>PKR {(profitSummary.mediaRevenue-profitSummary.mediaCost).toLocaleString(undefined,{maximumFractionDigits:2})}</b><em>{profitSummary.mediaRevenue.toFixed(2)} revenue − {profitSummary.mediaCost.toFixed(2)} cost</em></span><span><small>Wallet liability</small><b>{liability.toFixed(2)} credits</b><em>Purchased + promotional balance</em></span><span><small>Usage captured</small><b>{spend30.toFixed(2)} credits</b><em>Recent jobs shown in operations</em></span></div>
  <div className="admin-dashboard-grid"><article className="admin-chart-card"><div className="admin-card-head"><div><small>Cash received</small><h2>14-day payment trend</h2></div><b>PKR {days.reduce((s,d)=>s+d.value,0).toLocaleString()}</b></div><div className="admin-bars">{days.map(d=><div key={d.label} title={`${d.label}: PKR ${d.value.toLocaleString()}`}><i style={{height:`${Math.max(4,d.value/max*100)}%`}}/><span>{d.label}</span></div>)}</div></article><article className="admin-health-card"><div className="admin-card-head"><div><small>Operations</small><h2>Needs attention</h2></div><Gauge weight="duotone"/></div><HealthRow icon={Clock} label="Payments awaiting review" value={pending.length} onClick={()=>openTab("payments")}/><HealthRow icon={Activity} label="Jobs currently processing" value={active.length} onClick={()=>openTab("jobs")}/><HealthRow icon={WarningCircle} label="Failed jobs · 7 days" value={failed.length} danger onClick={()=>openTab("jobs")}/><HealthRow icon={CheckCircle} label="Open support tickets" value={open.length} onClick={()=>openTab("support")}/></article></div>
  <div className="admin-dashboard-grid lower"><article className="admin-list-card"><div className="admin-card-head"><div><small>Recent activity</small><h2>Latest payments</h2></div><button onClick={()=>openTab("payments")}>View all <ArrowRight/></button></div>{payments.slice(0,5).map(p=><div className="admin-activity-row" key={p.id}><span><b>{p.email||"Unknown user"}</b><small>{p.public_id} · {p.method}</small></span><span><b>PKR {p.amount_pkr.toLocaleString()}</b><small>{p.status}</small></span></div>)}</article><article className="admin-list-card"><div className="admin-card-head"><div><small>Infrastructure</small><h2>Platform inventory</h2></div><button onClick={()=>openTab("models")}>Manage <ArrowRight/></button></div><div className="admin-inventory"><span><b>{models.filter(m=>m.active).length}/{models.length}</b><small>Active models</small></span><span><b>{routes.filter(r=>r.active).length}</b><small>Provider routes</small></span><span><b>{jobs.filter(j=>j.status==="completed").length}</b><small>Completed jobs</small></span><span><b>{tickets.length}</b><small>Total tickets</small></span></div></article></div></section>
}
function HealthRow({icon:Icon,label,value,danger,onClick}:{icon:typeof Clock;label:string;value:number;danger?:boolean;onClick:()=>void}){return <button className={danger&&value?"danger":""} onClick={onClick}><Icon weight="duotone"/><span>{label}</span><b>{value}</b><ArrowRight/></button>}

