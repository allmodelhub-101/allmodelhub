"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight, Bell, CaretDown, CaretLeft, CaretRight, ChatCircle, ClockCounterClockwise, Coins,
  DotsThree, File, Folder, GearSix, ImageSquare, Lifebuoy, Receipt,
  ShieldCheck, SignOut, Sparkle, SquaresFour, VideoCamera, Wallet, Waveform, X
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import "./app-sidebar.css";
import { useWorkspaceOverlay } from "./use-workspace-overlay";

type NavItem = { label: string; href: string; icon: Icon };

const createItems: NavItem[] = [
  { label: "Chat", href: "/chat", icon: ChatCircle },
  { label: "Image", href: "/images", icon: ImageSquare },
  { label: "Video", href: "/video", icon: VideoCamera },
  { label: "Audio", href: "/audio", icon: Waveform }
];
const workspaceItems: NavItem[] = [
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Library", href: "/history", icon: ClockCounterClockwise },
  { label: "Files", href: "/files", icon: File }
];
const exploreItems: NavItem[] = [
  { label: "Models", href: "/models", icon: SquaresFour },
  { label: "Compare", href: "/battle", icon: ArrowsLeftRight },
  { label: "Templates", href: "/templates", icon: Sparkle },
];
const accountItems: NavItem[] = [
  { label: "Usage & Receipts", href: "/usage", icon: Receipt },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: GearSix },
  { label: "Help & Support", href: "/support", icon: Lifebuoy }
];
const mobileMoreItems = [...workspaceItems, ...exploreItems, { label: "Wallet", href: "/wallet", icon: Wallet }, ...accountItems];

function isActive(pathname: string, href: string) {
  return href === "/chat" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const navigationTranslations: Record<string, Record<string, string>> = {
  ur: { "/chat":"چیٹ", "/images":"تصاویر", "/video":"ویڈیو", "/audio":"آڈیو", "/projects":"پروجیکٹس", "/history":"لائبریری", "/models":"ماڈلز", "/battle":"موازنہ", "/files":"فائلیں", "/wallet":"والٹ", "/templates":"ٹیمپلیٹس", "/usage":"استعمال اور رسیدیں", "/notifications":"اطلاعات", "/settings":"ترتیبات", "/support":"مدد" },
  "roman-ur": { "/chat":"Chat", "/images":"Tasveerain", "/video":"Video", "/audio":"Audio", "/projects":"Projects", "/history":"Library", "/models":"Models", "/battle":"Muqabla", "/files":"Files", "/wallet":"Wallet", "/templates":"Templates", "/usage":"Istemaal aur receipts", "/notifications":"Notifications", "/settings":"Settings", "/support":"Madad" }
};

function translatedLabel(item: NavItem, language: string) { return navigationTranslations[language]?.[item.href] || item.label; }

function translatedSectionLabel(label: "Create" | "Workspace" | "Explore", language: string) {
  const labels = {
    Create: { ur: "تخلیق", "roman-ur": "Takhleeq" },
    Workspace: { ur: "ورک اسپیس", "roman-ur": "Workspace" },
    Explore: { ur: "دریافت", "roman-ur": "Daryaft" }
  } as const;
  return language === "ur" ? labels[label].ur : language === "roman-ur" ? labels[label]["roman-ur"] : label;
}

function NavLink({ item, pathname, collapsed = false, language = "en" }: { item: NavItem; pathname: string; collapsed?: boolean; language?: string }) {
  const active = isActive(pathname, item.href);
  const ItemIcon = item.icon;
  const label = translatedLabel(item, language);
  return (
    <Link className={`sidebar-link ${active ? "active" : ""}`} href={item.href} aria-label={label} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}>
      <ItemIcon className="sidebar-icon" size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
      <span className="sidebar-label">{label}</span>
    </Link>
  );
}

export function AppSidebar({ balance, displayName, email, isAdmin, language = "en" }: { balance: number; displayName?: string | null; email?: string | null; isAdmin: boolean; language?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const mobileSheetRef = useRef<HTMLElement | null>(null);
  useWorkspaceOverlay(mobileMoreOpen, mobileSheetRef, () => setMobileMoreOpen(false));
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setCollapsed(window.localStorage.getItem("amh-sidebar-collapsed") === "true"); } catch { /* Storage may be disabled; navigation must still work. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { setMobileMoreOpen(false); setAccountOpen(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccountOpen(false); accountTriggerRef.current?.focus(); } };
    const blur = (event: FocusEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    accountMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    document.addEventListener("pointerdown", close); document.addEventListener("focusin", blur); window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("focusin", blur); window.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  function toggleCollapsed() {
    setAccountOpen(false);
    setCollapsed((value) => {
      const next = !value;
      try { window.localStorage.setItem("amh-sidebar-collapsed", String(next)); } catch { /* Keep the toggle usable without storage. */ }
      return next;
    });
  }

  const initials = (displayName || email || "M").slice(0, 1).toUpperCase();

  function accountKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!accountOpen) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  }

  return <>
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
      <div className="sidebar-head">
        <Link href="/chat" className="sidebar-brand" aria-label={`${BRAND.name} workspace`}><Image className="brand-logo" src={BRAND.logoPath} alt="" width={44} height={44} priority /><span className="sidebar-brand-copy">{BRAND.name}</span></Link>
        <button className="sidebar-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-sidebar-links" onClick={toggleCollapsed}>{collapsed ? <CaretRight size={16} aria-hidden="true" /> : <CaretLeft size={16} aria-hidden="true" />}</button>
      </div>
      <nav className="sidebar-scroll" id="workspace-sidebar-links" aria-label="Workspace pages">
        {[{ label: "Create" as const, items: createItems }, { label: "Workspace" as const, items: workspaceItems }, { label: "Explore" as const, items: exploreItems }].map(({ label, items }) => <div className="sidebar-group" key={label}><div className="sidebar-section">{translatedSectionLabel(label, language)}</div><div className="sidebar-nav">{items.map((item) => <NavLink item={item} pathname={pathname} collapsed={collapsed} language={language} key={item.href} />)}</div></div>)}
      </nav>
      <Link className="sidebar-credit-cta" href="/wallet" title={collapsed ? "Add credits" : undefined} aria-label={`Add credits in Wallet. ${balance.toFixed(2)} credits available.`}><span className="sidebar-credit-icon"><Coins size={18} weight="fill" aria-hidden="true" /></span><span className="sidebar-credit-copy"><strong>Keep creating</strong><small data-balance={balance.toFixed(2)}>Top up credits anytime.</small></span><b>Add credits</b></Link>
      <div className="sidebar-bottom" ref={accountMenuRef} onKeyDown={accountKeys}>
        <button ref={accountTriggerRef} className="sidebar-profile" type="button" onClick={() => setAccountOpen((value) => !value)} aria-haspopup="menu" aria-expanded={accountOpen} aria-controls={accountOpen ? "sidebar-account-menu" : undefined} aria-label="Open account menu" title={collapsed ? displayName || email || "Account" : undefined}><span className="profile-avatar">{initials}</span><span className="profile-copy"><strong>{displayName || "Member"}</strong><small>{email || "Account"}</small></span><CaretDown className="profile-menu-caret" size={14} aria-hidden="true" /></button>
        {accountOpen && <div className="sidebar-account-menu" id="sidebar-account-menu" role="menu" aria-label="Account">
          {accountItems.map((item) => { const ItemIcon = item.icon; return <Link href={item.href} role="menuitem" key={item.href} onClick={() => setAccountOpen(false)}><ItemIcon size={17} aria-hidden="true" /><span>{translatedLabel(item, language)}</span></Link>; })}
          {isAdmin && <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)}><ShieldCheck size={17} aria-hidden="true" /><span>Admin Control Center</span></Link>}
          <div className="sidebar-account-divider" />
          <form action="/auth/logout" method="post"><button className="sidebar-signout" type="submit" role="menuitem"><SignOut size={18} aria-hidden="true" /><span>{language==="ur"?"سائن آؤٹ":"Sign out"}</span></button></form>
        </div>}
      </div>
    </aside>

    {mobileMoreOpen && <div className="mobile-nav-layer"><button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileMoreOpen(false)} /><section ref={mobileSheetRef} tabIndex={-1} className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label="Workspace navigation"><div className="mobile-sheet-head"><div><strong>{BRAND.name}</strong><span>Workspace</span></div><button type="button" aria-label="Close navigation" onClick={() => setMobileMoreOpen(false)}><X size={19} /></button></div><div className="mobile-sheet-grid">{mobileMoreItems.map((item) => { const ItemIcon = item.icon; return <Link className={isActive(pathname, item.href) ? "active" : ""} href={item.href} onClick={() => setMobileMoreOpen(false)} key={item.href}><ItemIcon size={21} weight={isActive(pathname, item.href) ? "fill" : "regular"} aria-hidden="true" /><span>{translatedLabel(item, language)}</span></Link>; })}{isAdmin && <Link href="/admin" onClick={() => setMobileMoreOpen(false)}><ShieldCheck size={21} /><span>Admin</span></Link>}</div></section></div>}

    <nav className="mobile-nav" aria-label="Mobile workspace navigation">{createItems.map((item) => { const ItemIcon = item.icon; const active = isActive(pathname, item.href); return <Link className={active ? "active" : ""} href={item.href} aria-current={active ? "page" : undefined} key={item.href}><ItemIcon size={21} weight={active ? "fill" : "regular"} aria-hidden="true" /><small>{translatedLabel(item, language)}</small></Link>; })}<button className={mobileMoreOpen ? "active" : ""} type="button" onClick={(event) => { event.currentTarget.focus(); setMobileMoreOpen(true); }} aria-label="Open more navigation" aria-expanded={mobileMoreOpen}><DotsThree size={22} weight="bold" aria-hidden="true" /><small>More</small></button></nav>
  </>;
}

export function MobileNavButton() { return null; }

export { createItems, workspaceItems, exploreItems, accountItems };

