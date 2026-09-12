"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("amh-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    // The browser preference is intentionally read after hydration to keep SSR markup deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.dataset.theme = theme;
    }
  }, [mounted, theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("amh-theme", next);
    document.documentElement.dataset.theme = next;
  }

  const nextLabel = !mounted ? "Change theme" : theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return <button className="theme-toggle" onClick={toggle} aria-label={nextLabel} title={nextLabel}>{mounted && theme === "light" ? <Moon size={17} weight="fill" aria-hidden="true" /> : <Sun size={17} weight="fill" aria-hidden="true" />}</button>;
}

