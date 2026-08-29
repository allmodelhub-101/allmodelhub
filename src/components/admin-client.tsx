"use client";

import { FormEvent, useMemo, useState } from "react";

type Payment = {
  id: string; public_id: string; method: string; amount_pkr: number; credits: number; status: string;
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
type Tab = "payments" | "models" | "providers" | "users" | "jobs" | "support" | "settings";

export function AdminClient(props: {
  payments: Payment[]; models: Model[]; users: UserRow[]; routes: ProviderRoute[]; jobs: Job[]; tickets: Ticket[];
  settings: Record<string, number>;
}) {
  const [tab, setTab] = useState<Tab>("payments");
  const [payments, setPayments] = useState(props.payments);
  const [models, setModels] = useState(props.models);
  const [routes, setRoutes] = useState(props.routes);
  const [users, setUsers] = useState(props.users);
  const [tickets, setTickets] = useState(props.tickets);
  const [status, setStatus] = useState("");
  const [platformSettings, setPlatformSettings] = useState(props.settings);
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
      welcomeCredits: Number(form.get("welcomeCredits"))
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "payments", label: "Payments" }, { id: "models", label: "Models" }, { id: "providers", label: "Providers" },
    { id: "users", label: "Users" }, { id: "jobs", label: "Jobs" }, { id: "support", label: "Support" }, { id: "settings", label: "Platform" }
  ];

  return <div style={{ display: "grid", gap: 20 }}>
    <div className="mode-row" style={{ overflowX: "auto" }}>{tabs.map((item) => <button key={item.id} className={`mode-pill ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {status && <div className="soft-card small" style={{ padding: 12 }}>{status}</div>}

    {tab === "payments" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Manual payments</h2><div className="table-wrap"><table><thead><tr><th>Order</th><th>User</th><th>Method</th><th>Amount</th><th>Reference</th><th>Status</th><th>Proof</th><th>Action</th></tr></thead><tbody>{payments.length ? payments.map((payment) => <tr key={payment.id}><td>{payment.public_id}</td><td>{payment.email || "—"}</td><td>{payment.method}</td><td>PKR {Number(payment.amount_pkr).toLocaleString()}</td><td>{payment.transaction_reference}</td><td><span className={`badge ${payment.status === "approved" ? "success" : payment.status === "rejected" ? "danger" : "warning"}`}>{payment.status}</span></td><td>{payment.proofUrl ? <a className="btn btn-ghost" href={payment.proofUrl} target="_blank" rel="noreferrer">View ↗</a> : "—"}</td><td>{!["approved", "rejected", "duplicate", "cancelled"].includes(payment.status) ? <div style={{ display: "flex", gap: 6 }}><button className="btn btn-primary" onClick={() => paymentAction(payment.id, "approve")}>Approve</button><button className="btn btn-danger" onClick={() => paymentAction(payment.id, "reject")}>Reject</button></div> : "—"}</td></tr>) : <tr><td colSpan={8} className="muted">No payment submissions.</td></tr>}</tbody></table></div></section>}

    {tab === "models" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Model controls</h2><div className="table-wrap"><table><thead><tr><th>Model</th><th>Tier</th><th>Type</th><th>Provider family</th><th>Markup</th><th>Auto</th><th>Active</th></tr></thead><tbody>{models.map((model) => <tr key={model.id}><td><b>{model.display_name}</b><div className="muted small">{model.id}</div></td><td>{model.tier}</td><td>{model.modality}</td><td>{model.provider_family}</td><td><input className="input" style={{ width: 90, padding: 7 }} type="number" min={1} max={20} step={0.05} defaultValue={Number(model.markup)} onBlur={(event) => updateModel(model.id, { markup: Number(event.target.value) })} /></td><td><button className={`btn ${model.auto_eligible ? "btn-primary" : ""}`} onClick={() => updateModel(model.id, { autoEligible: !model.auto_eligible })}>{model.auto_eligible ? "Eligible" : "Excluded"}</button></td><td><button className={`btn ${model.active ? "btn-primary" : ""}`} onClick={() => updateModel(model.id, { active: !model.active })}>{model.active ? "Active" : "Disabled"}</button></td></tr>)}</tbody></table></div></section>}

    {tab === "providers" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Provider routing</h2><form className="card studio-panel" onSubmit={createProviderRoute} style={{ marginBottom: 14 }}><div className="form-grid"><label className="label">AMH model<select className="select" name="modelId" required>{models.map((model) => <option key={model.id} value={model.id}>{model.display_name}</option>)}</select></label><label className="label">Provider<select className="select" name="providerKey"><option value="apimodels">APIMODELS</option><option value="haimaker">Haimaker</option></select></label><label className="label">Upstream model<input className="input" name="upstreamModel" required /></label><label className="label">Priority<input className="input" name="priority" type="number" defaultValue={100} min={1} max={1000} /></label></div><button className="btn btn-primary" type="submit">Add / update route</button></form><div className="table-wrap"><table><thead><tr><th>AMH model</th><th>Provider</th><th>Upstream model</th><th>Priority</th><th>Status</th></tr></thead><tbody>{routes.length ? routes.map((route) => <tr key={`${route.model_id}:${route.provider_key}`}><td>{route.model_id}</td><td>{route.provider_key}</td><td><input className="input" style={{ minWidth: 210, padding: 7 }} defaultValue={route.upstream_model} onBlur={(event) => saveProviderRoute(route, { upstream_model: event.target.value })} /></td><td><input className="input" style={{ width: 80, padding: 7 }} type="number" min={1} max={1000} defaultValue={route.priority} onBlur={(event) => saveProviderRoute(route, { priority: Number(event.target.value) })} /></td><td><button className={`btn ${route.active ? "btn-primary" : ""}`} onClick={() => saveProviderRoute(route, { active: !route.active })}>{route.active ? "Active" : "Disabled"}</button></td></tr>) : <tr><td colSpan={5} className="muted">No provider routes configured.</td></tr>}</tbody></table></div></section>}

    {tab === "users" && <section><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", marginBottom: 14 }}><div><h2 className="page-title">Users & wallets</h2><p className="muted small">Admin credit actions are written to the wallet ledger and audit log.</p></div><input className="input" style={{ maxWidth: 330 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, name, or user ID" /></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Purchased</th><th>Promo</th><th>Reserved</th><th>Welcome</th><th>Action</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td><b>{user.email || user.display_name || "User"}</b><div className="muted small">{user.id}</div></td><td>{user.role}</td><td>{Number(user.wallet?.purchased_balance ?? 0).toFixed(2)}</td><td>{Number(user.wallet?.promo_balance ?? 0).toFixed(2)}</td><td>{Number(user.wallet?.reserved_balance ?? 0).toFixed(2)}</td><td>{user.welcome_granted_at ? "Granted" : "Not granted"}</td><td><button className="btn" onClick={() => addCredit(user.id)}>Adjust +</button></td></tr>)}</tbody></table></div></section>}

    {tab === "jobs" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Generation jobs</h2><div className="table-wrap"><table><thead><tr><th>Job</th><th>User</th><th>Type</th><th>Model</th><th>Provider</th><th>Status</th><th>Charged</th><th>Error</th></tr></thead><tbody>{props.jobs.length ? props.jobs.map((job) => <tr key={job.id}><td>{job.public_id}</td><td>{job.email || "—"}</td><td>{job.modality}</td><td>{job.model_id}</td><td>{job.provider_key || "—"}</td><td><span className={`badge ${job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}`}>{job.status}</span></td><td>{Number(job.charged_credits ?? 0).toFixed(2)}</td><td className="small">{job.error_message || "—"}</td></tr>) : <tr><td colSpan={8} className="muted">No media jobs yet.</td></tr>}</tbody></table></div></section>}

    {tab === "support" && <section><h2 className="page-title" style={{ marginBottom: 14 }}>Support queue</h2><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>User</th><th>Category</th><th>Subject</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{tickets.length ? tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.public_id}</td><td>{ticket.email || "—"}</td><td>{ticket.category}</td><td>{ticket.subject}</td><td>{ticket.status}</td><td>{new Date(ticket.updated_at).toLocaleString()}</td><td><button className="btn btn-primary" onClick={() => replyTicket(ticket)}>Reply</button></td></tr>) : <tr><td colSpan={7} className="muted">No tickets.</td></tr>}</tbody></table></div></section>}

    {tab === "settings" && <section><h2 className="page-title" style={{ marginBottom: 6 }}>Platform economics</h2><p className="muted" style={{ marginBottom: 14 }}>These server-side settings control the conservative internal FX basis, minimum manual top-up, and verified welcome promotion. Supplier acquisition costs remain hidden from customers.</p><form className="card studio-panel" onSubmit={savePlatformSettings}><div className="form-grid"><label className="label">Internal USD → PKR basis<input className="input" name="internalUsdPkr" type="number" min={1} step={0.01} defaultValue={platformSettings.internal_usd_pkr ?? 310} /></label><label className="label">Minimum top-up (PKR)<input className="input" name="minTopupPkr" type="number" min={1} step={1} defaultValue={platformSettings.min_topup_pkr ?? 500} /></label><label className="label">Welcome promotional credits<input className="input" name="welcomeCredits" type="number" min={0} step={1} defaultValue={platformSettings.welcome_credits ?? 10} /></label></div><button className="btn btn-primary" type="submit">Save platform settings</button></form></section>}
  </div>;
}
