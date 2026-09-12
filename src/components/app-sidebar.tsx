"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight, Bell, CaretLeft, CaretRight, ChatCircle, ClockCounterClockwise,
  DotsThree, File, Folder, GearSix, ImageSquare, Lifebuoy, Plus, Receipt,
  ShieldCheck, SignOut, Sparkle, SquaresFour, VideoCamera, Wallet, Waveform, X
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { label: string; href: string; icon: Icon };

const primaryItems: NavItem[] = [
  { label: "Chat", href: "/chat", icon: ChatCircle },
  { label: "Image", href: "/images", icon: ImageSquare },
  { label: "Video", href: "/video", icon: VideoCamera },
  { label: "Audio", href: "/audio", icon: Waveform },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Library", href: "/history", icon: ClockCounterClockwise },
  { label: "Models", href: "/models", icon: SquaresFour }
];

const moreItems: NavItem[] = [
  { label: "Compare Models", href: "/battle", icon: ArrowsLeftRight },
  { label: "Files", href: "/files", icon: File },
  { label: "Templates", href: "/templates", icon: Sparkle },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Usage & Receipts", href: "/usage", icon: Receipt },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: GearSix },
  { label: "Help", href: "/support", icon: Lifebuoy }
];

const creationItems = primaryItems.slice(0, 4);

function isActive(pathname: string, href: string) {
  return href === "/chat" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, collapsed = false }: { item: NavItem; pathname: string; collapsed?: boolean }) {
  const active = isActive(pathname, item.href);
  const ItemIcon = item.icon;
  return (
    <Link className={`sidebar-link ${active ? "active" : ""}`} href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
      <ItemIcon className="sidebar-icon" size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
      <span className="sidebar-label">{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ balance, displayName, email, isAdmin }: { balance: number; displayName?: string | null; email?: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCollapsed(window.localStorage.getItem("amh-sidebar-collapsed") === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setMobileMoreOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", mobileMoreOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [mobileMoreOpen]);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("amh-sidebar-collapsed", String(next));
      return next;
    });
  }

  const initials = (displayName || email || "M").slice(0, 1).toUpperCase();

  return <>
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
      <div className="sidebar-head">
        <Link href="/chat" className="sidebar-brand" aria-label="All Model Hub workspace"><span className="brand-mark" /><span className="sidebar-brand-copy">All Model Hub</span></Link>
        <button className="sidebar-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>{collapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}</button>
      </div>
      <Link href="/wallet" className="sidebar-balance" title="Open wallet"><Wallet className="balance-icon" size={18} aria-hidden="true" /><span><strong>{balance.toFixed(2)}</strong><small>available credits</small></span><CaretRight className="balance-arrow" size={14} aria-hidden="true" /></Link>
      <details className="creation-launcher">
        <summary className="sidebar-new"><Plus size={18} weight="bold" aria-hidden="true" /><span className="sidebar-label">New creation</span></summary>
        <div className="creation-menu">{creationItems.map((item) => { const ItemIcon = item.icon; return <Link href={item.href} key={item.href}><ItemIcon size={20} aria-hidden="true" /><span><b>{item.label}</b><small>Start a new {item.label.toLowerCase()} creation</small></span><CaretRight size={14} aria-hidden="true" /></Link>; })}</div>
      </details>
      <nav className="sidebar-scroll">
        <div className="sidebar-group"><div className="sidebar-section">Workspace</div><div className="sidebar-nav">{primaryItems.map((item) => <NavLink item={item} pathname={pathname} collapsed={collapsed} key={item.href} />)}</div></div>
        <details className="sidebar-more"><summary><DotsThree className="sidebar-icon" size={20} weight="bold" aria-hidden="true" /><span className="sidebar-label">More tools</span></summary><div className="sidebar-more-menu"><div className="sidebar-more-title"><span>Workspace tools</span><small>Manage, compare and configure</small></div><div className="sidebar-more-grid">{moreItems.map((item) => <NavLink item={item} pathname={pathname} collapsed={collapsed} key={item.href} />)}</div></div></details>
        {isAdmin && <div className="sidebar-group"><div className="sidebar-nav"><Link className={`sidebar-link ${isActive(pathname, "/admin") ? "active" : ""}`} href="/admin" title={collapsed ? "Admin Control Center" : undefined}><ShieldCheck className="sidebar-icon" size={19} aria-hidden="true" /><span className="sidebar-label">Admin Control Center</span></Link></div></div>}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span className="profile-copy"><strong>{displayName || "Member"}</strong><small>{email || "Account"}</small></span></div><form action="/auth/logout" method="post"><button className="sidebar-signout" type="submit" title={collapsed ? "Sign out" : undefined}><SignOut size={18} aria-hidden="true" /><span className="sidebar-label">Sign out</span></button></form></div>
    </aside>

    {mobileMoreOpen && <div className="mobile-nav-layer"><button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileMoreOpen(false)} /><section className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label="Workspace navigation"><div className="mobile-sheet-head"><div><strong>All Model Hub</strong><span>Workspace</span></div><button type="button" aria-label="Close navigation" onClick={() => setMobileMoreOpen(false)}><X size={19} /></button></div><div className="mobile-sheet-grid">{[...primaryItems.slice(4), ...moreItems].map((item) => { const ItemIcon = item.icon; return <Link className={isActive(pathname, item.href) ? "active" : ""} href={item.href} key={item.href}><ItemIcon size={21} weight={isActive(pathname, item.href) ? "fill" : "regular"} aria-hidden="true" /><span>{item.label}</span></Link>; })}{isAdmin && <Link href="/admin"><ShieldCheck size={21} /><span>Admin</span></Link>}</div></section></div>}

    <nav className="mobile-nav" aria-label="Mobile workspace navigation">{creationItems.map((item) => { const ItemIcon = item.icon; const active = isActive(pathname, item.href); return <Link className={active ? "active" : ""} href={item.href} key={item.href}><ItemIcon size={21} weight={active ? "fill" : "regular"} aria-hidden="true" /><small>{item.label}</small></Link>; })}<button type="button" onClick={() => setMobileMoreOpen(true)} aria-label="Open more navigation" aria-expanded={mobileMoreOpen}><DotsThree size={22} weight="bold" aria-hidden="true" /><small>More</small></button></nav>
  </>;
}

export function MobileNavButton() { return null; }

export { primaryItems, moreItems };

