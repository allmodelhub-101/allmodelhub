"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const stored = localStorage.getItem("amh-theme") || "dark";
    setTheme(stored);
    document.documentElement.dataset.theme = stored;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("amh-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return <button className="btn btn-ghost" onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? "☀ Light" : "◐ Dark"}</button>;
}
