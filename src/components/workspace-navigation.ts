"use client";

import { useSyncExternalStore } from "react";

const compactQuery = "(max-width: 600px)";
function subscribeCompact(listener: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function useCompactWorkspaceHeader() {
  return useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches, () => false);
}

// UI-only bridge between sibling navigation components. Jobs stay owned by
// the existing topbar hook; this store contains only its derived active count.
let activeCount = 0;
const listeners = new Set<() => void>();
export const workspaceGenerationStatus = {
  publish(count: number) {
    if (count === activeCount) return;
    activeCount = count;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => activeCount,
  getServerSnapshot: () => 0,
};
export const openWorkspaceGenerations = () => window.dispatchEvent(new Event("amh-open-generation-center"));
