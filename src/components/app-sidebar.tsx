"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { label: string; href: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Create", items: [
    { label: "New Chat", href: "/chat", icon: "✦" }, { label: "Images", href: "/images", icon: "▧" },
    { label: "Video", href: "/video", icon: "▶" }, { label: "Audio", href: "/audio", icon: "◖" },
  ] },
  { label: "Workspace", items: [
    { label: "History", href: "/history", icon: "◷" }, { label: "Projects", href: "/projects", icon: "⌘" },
    { label: "Files", href: "/files", icon: "□" }, { label: "Templates", href: "/templates", icon: "▤" },
  ] },
  { label: "AI", items: [
    { label: "Models", href: "/models", icon: "◈" }, { label: "Model Battle", href: "/battle", icon: "⚔" },
  ] },
  { label: "Account", items: [
    { label: "Wallet", href: "/wallet", icon: "₨" }, { label: "Usage & Receipts", href: "/usage", icon: "▥" },
    { label: "Notifications", href: "/notifications", icon: "◌" }, { label: "Settings", href: "/settings", icon: "⚙" },
    { label: "Help", href: "/support", icon: "?" },
  ] },
];

function isActive(pathname: string, href: string) { return href === "/chat" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); }

export function AppSidebar({ balance, displayName, email, isAdmin }: { balance: number; displayName?: string | null; email?: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCollapsed(window.localStorage.getItem("amh-sidebar-collapsed") === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", open);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [open]);

  function toggleCollapsed() {
    setCollapsed((value) => { const next = !value; window.localStorage.setItem("amh-sidebar-collapsed", String(next)); return next; });
  }

  const initials = (displayName || email || "M").slice(0, 1).toUpperCase();
  return <>
    <button className="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><span /><span /><span /></button>
    {open && <button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : ""} ${open ? "is-open" : ""}`} aria-label="Authenticated navigation">
      <div className="sidebar-head"><Link href="/" className="sidebar-brand"><span className="brand-mark" /><span className="sidebar-brand-copy">All Model Hub</span></Link><button className="sidebar-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>{collapsed ? "›" : "‹"}</button><button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div>
      <Link href="/wallet" className="sidebar-balance" title="Open Wallet"><span className="balance-icon">₨</span><span><strong>{balance.toFixed(2)}</strong><small>available credits</small></span><span className="balance-arrow">↗</span></Link>
      <nav className="sidebar-scroll">
        {groups.map((group) => <div className="sidebar-group" key={group.label}><div className="sidebar-section">{group.label}</div><div className="sidebar-nav">{group.items.map((item) => <Link className={`sidebar-link ${isActive(pathname, item.href) ? "active" : ""}`} href={item.href} key={item.href} title={collapsed ? item.label : undefined} aria-current={isActive(pathname, item.href) ? "page" : undefined}><span className="sidebar-icon" aria-hidden="true">{item.icon}</span><span className="sidebar-label">{item.label}</span></Link>)}</div></div>)}
        {isAdmin && <div className="sidebar-group"><div className="sidebar-nav"><Link className={`sidebar-link ${isActive(pathname, "/admin") ? "active" : ""}`} href="/admin" title={collapsed ? "Admin Control Center" : undefined}><span className="sidebar-icon" aria-hidden="true">◆</span><span className="sidebar-label">Admin Control Center</span></Link></div></div>}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span className="profile-copy"><strong>{displayName || "Member"}</strong><small>{email || "Account"}</small></span></div><form action="/auth/logout" method="post"><button className="sidebar-signout" type="submit" title={collapsed ? "Sign out" : undefined}><span aria-hidden="true">↗</span><span className="sidebar-label">Sign out</span></button></form></div>
    </aside>
  </>;
}

export function MobileNavButton() { return null; }

export { groups };

