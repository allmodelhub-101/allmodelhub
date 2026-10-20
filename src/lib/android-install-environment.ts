"use client";

import { useSyncExternalStore } from "react";

const standaloneQuery = "(display-mode: standalone)";

type InstallEnvironment = "unknown" | "standalone" | "other-device" | "android-chrome" | "android-other";

function snapshot(): InstallEnvironment {
  const installed = window.matchMedia(standaloneQuery).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://");
  if (installed) return "standalone";
  if (!/Android/i.test(navigator.userAgent)) return "other-device";
  return /Chrome\//.test(navigator.userAgent) && !/EdgA|OPR|SamsungBrowser|; wv\)/.test(navigator.userAgent)
    ? "android-chrome" : "android-other";
}

function subscribe(listener: () => void) {
  const query = window.matchMedia(standaloneQuery);
  query.addEventListener("change", listener);
  window.addEventListener("appinstalled", listener);
  return () => {
    query.removeEventListener("change", listener);
    window.removeEventListener("appinstalled", listener);
  };
}

export function useAndroidInstallEnvironment() {
  return useSyncExternalStore(subscribe, snapshot, () => "unknown" as const);
}
