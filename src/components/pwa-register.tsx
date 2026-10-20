"use client";
import { useEffect } from "react";
import { setInstallPrompt, type InstallPrompt } from "@/lib/pwa-install";

export function PwaRegister() {
  useEffect(() => {
    // Retain the one-shot prompt for the explicit Android-page button. Chrome's
    // menu remains available; do not inject install banners into existing pages.
    const available = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}
