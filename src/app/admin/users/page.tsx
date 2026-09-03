import { AdminPageFrame } from "@/components/admin-overview";

export default function Page() {
  return <AdminPageFrame eyebrow="Customer operations" title="Users & wallets"><div className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">Account intelligence</span><h2>User activity and balances</h2></div><span className="admin-live"><i /> Live</span></div><p className="muted">Search accounts, inspect wallet balances, and keep support operations moving with a high-signal view of your users.</p><a className="btn btn-primary" href="/admin">Return to overview ↗</a></div></AdminPageFrame>;
}
