"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./cinematic-home.module.css";

const links = [["Product", "#product"], ["Models", "#models"], ["Pricing", "#pricing"], ["For Pakistan", "#pakistan"], ["FAQ", "#faq"]] as const;

export function HomeNav() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("amh-theme");
    const next = saved === "light" || (saved === null && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("amh-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return <>
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand} aria-label="All Model Hub home"><BrandMark /><span>All Model Hub</span></Link>
        <nav className={styles.navLinks} aria-label="Primary navigation">
          {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <button className={styles.themeButton} type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
          </button>
          <Link className={styles.login} href="/auth/login">Log in</Link>
          <Link className={styles.navCta} href="/auth/login">Start free <span aria-hidden="true">↗</span></Link>
          <button className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ""}`} type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-controls="mobile-navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}><i /><i /></button>
        </div>
      </div>
    </header>
    <div className={`${styles.mobileMenu} ${open ? styles.mobileMenuOpen : ""}`} id="mobile-navigation" aria-hidden={!open}>
      {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      <Link className={styles.mobileCta} href="/auth/login" onClick={() => setOpen(false)}>Start creating free ↗</Link>
      <small>Every leading AI. One PKR wallet.</small>
    </div>
  </>;
}

function BrandMark() {
  return <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>;
}

