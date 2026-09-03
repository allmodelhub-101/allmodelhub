import { AdminPageFrame } from "@/components/admin-overview";

export default function Page() {
  return <AdminPageFrame eyebrow="Platform governance" title="System settings"><div className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">Configuration</span><h2>Platform controls</h2></div><span className="admin-live"><i /> Protected</span></div><p className="muted">Manage API configuration, security policies, pricing controls, and platform-wide defaults.</p><a className="btn btn-primary" href="/admin">Return to overview ↗</a></div></AdminPageFrame>;
}
