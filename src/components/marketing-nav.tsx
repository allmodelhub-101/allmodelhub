"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./marketing-nav.module.css";

const navLinks = [
  ["Models", "#models"],
  ["Create", "#create"],
  ["Credits", "#credits"],
  ["Pakistan", "#pakistan"],
  ["FAQ", "#faq"],
] as const;

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <>
    <nav className="marketing-nav" aria-label="Primary navigation">
      <div className="container marketing-nav-inner">
        <Link href="/" className="brand"><span className="brand-mark" />All Model Hub</Link>
        <div className="nav-links">{navLinks.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="btn btn-ghost" href="/auth/login">Login</Link>
          <Link className="btn btn-primary" href="/auth/login">Start Free</Link>
          <button className={`${styles.menuButton} ${open ? styles.open : ""}`} type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="marketing-mobile-menu" onClick={() => setOpen((value) => !value)}><span /><span /></button>
        </div>
      </div>
    </nav>
    <div className={`${styles.backdrop} ${open ? styles.visible : ""}`} aria-hidden="true" onClick={() => setOpen(false)} />
    <div className={`${styles.mobileMenu} ${open ? styles.visible : ""}`} id="marketing-mobile-menu" aria-hidden={!open}>
      <nav aria-label="Mobile navigation">{navLinks.map(([label, href], index) => <a href={href} key={href} onClick={() => setOpen(false)}><small>0{index + 1}</small><span>{label}</span><b aria-hidden="true">↗</b></a>)}</nav>
      <div className={styles.mobileActions}><Link className="btn btn-ghost" href="/auth/login">Login</Link><Link className="btn btn-primary" href="/auth/login">Start Free</Link></div>
    </div>
  </>;
}

