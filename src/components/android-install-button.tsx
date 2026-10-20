"use client";

import { useState, useSyncExternalStore } from "react";
import { getInstallPrompt, getServerInstallPrompt, setInstallPrompt, subscribeInstall } from "@/lib/pwa-install";

export function AndroidInstallButton() {
  const prompt = useSyncExternalStore(subscribeInstall, getInstallPrompt, getServerInstallPrompt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setMessage(outcome === "accepted" ? "Installation accepted. Follow Chrome’s instructions to finish." : "You can install later from Chrome’s menu.");
    } catch {
      setMessage("Open Chrome’s menu and choose Install app or Add to Home screen.");
    } finally {
      setInstallPrompt(null);
      setBusy(false);
    }
  }
  return <div>
    {prompt ? <button type="button" onClick={install} disabled={busy}>{busy ? "Opening Chrome…" : "Install from Chrome"}</button> : <a href="#install-guide">Install from Chrome · View steps</a>}
    <p role="status" aria-live="polite">{message || "Chrome shows the install prompt when this device and website are eligible. Already installed? Open Models Suite from your launcher."}</p>
  </div>;
}
