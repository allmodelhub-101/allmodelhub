"use client";
import { useEffect, useState } from "react";
type Notification = { id: string; title: string; body: string; read_at?: string | null; created_at: string };

export function NotificationsClient() {
  const [items, setItems] = useState<Notification[]>([]);
  async function load() { const r = await fetch("/api/notifications"); if (r.ok) setItems((await r.json()).notifications || []); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function read(id?: string) { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) }); await load(); }
  return <div><div className="toolbar-row"><button className="btn btn-ghost" onClick={() => read()}>Mark all read</button></div><div className="list-grid">{items.length ? items.map((n) => <button className={`card list-card notification-button ${n.read_at ? "" : "unread"}`} key={n.id} onClick={() => read(n.id)}><div><b>{n.title}</b><div className="muted small notification-copy">{n.body}</div></div><div className="muted small">{new Date(n.created_at).toLocaleString()}</div></button>) : <div className="card empty-card">No notifications yet.</div>}</div></div>;
}
