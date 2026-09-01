"use client";

import { useEffect, useState } from "react";

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

  const label = !mounted ? "Theme" : theme === "dark" ? "☀ Light" : "◐ Dark";

  return <button className="btn btn-ghost" onClick={toggle} aria-label="Toggle theme">{label}</button>;
}
