"use client";

export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
export function setInstallPrompt(value: InstallPrompt | null) {
  prompt = value;
  listeners.forEach((listener) => listener());
}
export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getInstallPrompt = () => prompt;
export const getServerInstallPrompt = () => null;
