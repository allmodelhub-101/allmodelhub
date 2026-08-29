"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => typeof window === "undefined" ? "dark" : localStorage.getItem("amh-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("amh-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return <button className="btn btn-ghost" onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? "☀ Light" : "◐ Dark"}</button>;
}
