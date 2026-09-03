"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const navItems = [
  { href: "/admin", label: "Overview", icon: "⌁" },
  { href: "/admin/payments", label: "Payments", icon: "◈" },
  { href: "/admin/models", label: "Models", icon: "◇" },
  { href: "/admin/users", label: "Users", icon: "◎" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

const activity = [
  ["Payment review queue", "Manual deposits awaiting verification", "Review", "/admin/payments"],
  ["Model routing", "Provider availability and pricing controls", "Configure", "/admin/models"],
  ["User operations", "Wallet balances and account activity", "Inspect", "/admin/users"],
];

export function AdminOverview({ metrics }: { metrics: { revenue: number; users: number; generations: number; failed: number; models: number; pending: number } }) {
  const kpis = [
    { label: "Net revenue", value: `PKR ${metrics.revenue.toLocaleString()}`, trend: "+12.8%", tone: "cyan" },
    { label: "Active users", value: metrics.users.toLocaleString(), trend: "+8.4%", tone: "violet" },
    { label: "AI generations", value: metrics.generations.toLocaleString(), trend: "+24.6%", tone: "green" },
    { label: "Pending review", value: metrics.pending.toLocaleString(), trend: metrics.failed ? `${metrics.failed} failed` : "All clear", tone: "amber" },
  ];

  return <div className="admin-console">
    <aside className="admin-rail glass">
      <div className="admin-rail-brand"><span className="brand-mark" /><span><strong>AMH</strong><small>Control center</small></span></div>
      <div className="admin-rail-label">Workspace</div>
      <nav className="admin-rail-nav">{navItems.map((item, index) => <Link href={item.href} className={`admin-rail-link ${index === 0 ? "active" : ""}`} key={item.href}><span>{item.icon}</span>{item.label}</Link>)}</nav>
      <div className="admin-rail-footer"><span className="status-dot" /><span><strong>All systems operational</strong><small>Live platform status</small></span></div>
    </aside>
    <section className="admin-board">
      <header className="admin-board-header"><div><div className="kicker">Operations / 03 Sep 2026</div><h1>Good morning, operator.</h1><p>Here&apos;s the pulse of your AI platform.</p></div><div className="admin-header-actions"><span className="admin-live"><i /> Live telemetry</span><Link className="btn btn-primary" href="/admin/payments">Review queue <span>↗</span></Link></div></header>
      <div className="admin-kpi-grid">{kpis.map((kpi, index) => <motion.article className={`admin-kpi ${kpi.tone}`} key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><div className="admin-kpi-top"><span>{kpi.label}</span><b>↗</b></div><strong>{kpi.value}</strong><small><em>{kpi.trend}</em> vs last period</small></motion.article>)}</div>
      <div className="admin-main-grid"><article className="admin-panel admin-chart"><div className="admin-panel-head"><div><span className="admin-eyebrow">Platform activity</span><h2>Generation volume</h2></div><span className="admin-select">Last 30 days ˅</span></div><div className="admin-chart-total"><strong>{metrics.generations.toLocaleString()}</strong><span><em>+24.6%</em> generation throughput</span></div><div className="admin-bars" aria-label="Generation volume chart">{[38,52,44,68,60,76,65,82,72,88,79,94,84,100].map((height, index) => <motion.i key={index} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: .2 + index * .03 }} />)}</div><div className="admin-axis"><span>Aug 05</span><span>Aug 15</span><span>Aug 25</span><span>Sep 03</span></div></article><article className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">Provider health</span><h2>Runtime status</h2></div><span className="status-dot" /></div><div className="provider-list"><div><span className="provider-logo">A</span><span><strong>APIMODELS</strong><small>Primary inference route</small></span><em>99.98%</em></div><div><span className="provider-logo violet">H</span><span><strong>HAIMAKER</strong><small>Media generation route</small></span><em>99.91%</em></div></div><div className="health-meter"><span style={{ width: "99.95%" }} /></div><small className="muted">Average availability across active routes</small></article></div>
      <div className="admin-bottom-grid"><article className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">Command center</span><h2>Operational shortcuts</h2></div></div><div className="admin-activity">{activity.map((item) => <Link href={item[3]} key={item[0]}><span className="activity-icon">{item[0][0]}</span><span><strong>{item[0]}</strong><small>{item[1]}</small></span><b>{item[2]} ↗</b></Link>)}</div></article><article className="admin-panel admin-summary"><span className="admin-eyebrow">Platform footprint</span><h2>One view.<br /><span>Every signal.</span></h2><p>Monitor the financial, operational, and model health of your workspace from one calm, high-signal surface.</p><Link className="link-button" href="/admin/settings">Open platform settings ↗</Link></article></div>
    </section>
  </div>;
}

export function AdminPageFrame({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) { return <div className="admin-simple-page"><div className="admin-simple-top"><Link href="/admin" className="admin-back">← Control center</Link><span className="admin-live"><i /> Secure admin</span></div><div className="kicker">{eyebrow}</div><h1>{title}</h1>{children}</div>; }
