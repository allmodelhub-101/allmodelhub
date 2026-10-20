"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AndroidLogo, ArrowDown, ArrowRight, ArrowUpRight, CheckCircle } from "@phosphor-icons/react";
import { getInstallPrompt, getServerInstallPrompt, setInstallPrompt, subscribeInstall } from "@/lib/pwa-install";
import { useAndroidInstallEnvironment } from "@/lib/android-install-environment";
import styles from "./android-install-button.module.css";

export function AndroidInstallButton({ download }: { download?: { url: string; version: string } }) {
  const prompt = useSyncExternalStore(subscribeInstall, getInstallPrompt, getServerInstallPrompt);
  const environment = useAndroidInstallEnvironment();
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
  const chrome = environment === "android-chrome";
  const standalone = environment === "standalone";
  const apkPrimary = Boolean(download && environment === "android-other");
  const guidance = standalone ? "You’re already in the app. Your workspace is ready." :
    chrome ? prompt ? "Chrome web app · installs from your browser" : "Chrome web app · use ⋮ → Install app, or view the steps below." :
    environment === "android-other" ? "For web app installation, open this page in Chrome on Android." :
    environment === "other-device" ? "Android device required. Open this page in Chrome on your Android phone." :
    "Install the web app from Chrome on Android. Internet required.";

  return <div className={styles.controls} data-install-environment={environment}>
    <div className={styles.actions}>
      {standalone ? <Link className={styles.primary} href="/chat"><CheckCircle size={21} aria-hidden="true" />Open Models Suite<ArrowRight size={18} aria-hidden="true" /></Link> :
        apkPrimary ? <a className={styles.primary} href={download!.url}><ArrowDown size={21} aria-hidden="true" />Download Android APK<ArrowRight size={18} aria-hidden="true" /></a> :
          chrome && prompt ? <button className={styles.primary} type="button" onClick={install} disabled={busy}><AndroidLogo size={22} weight="duotone" aria-hidden="true" />{busy ? "Opening Chrome…" : "Install from Chrome"}<ArrowRight size={18} aria-hidden="true" /></button> :
            <a className={styles.primary} href="#install-guide"><AndroidLogo size={22} weight="duotone" aria-hidden="true" />{chrome ? "Install from Chrome" : environment === "android-other" ? "Chrome install guide" : "Get it on Android"}<ArrowRight size={18} aria-hidden="true" /></a>}
      {!standalone && download && !apkPrimary && <a className={styles.secondary} href={download.url}>Signed APK · v{download.version}<ArrowDown size={16} aria-hidden="true" /></a>}
      {apkPrimary && <a className={styles.secondary} href="#install-guide">Chrome web app<ArrowUpRight size={16} aria-hidden="true" /></a>}
    </div>
    <p className={styles.hint} role="status" aria-live="polite">{message || guidance}</p>
  </div>;
}
