export default function AdminHeader({email}:{email?:string}){return <header className="admin-header"><div><span className="admin-header-mark">AM</span><span><b>Control Center</b><small>All Model Hub operations</small></span></div><div className="admin-identity"><span className="status-dot"/><span><b>Administrator</b><small>{email||"Secure session"}</small></span></div></header>}

