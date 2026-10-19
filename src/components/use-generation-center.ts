"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loadGenerationSnapshot, type GenerationCenterJob } from "@/lib/generation-center";
import { chatActivity, emptyChatActivity } from "@/lib/chat-generation-activity";

export function useGenerationCenter(open: boolean, offline: boolean) {
  const [jobs, setJobs] = useState<GenerationCenterJob[]>([]);
  const chatJobs = useSyncExternalStore(chatActivity.subscribe, offline ? emptyChatActivity : chatActivity.getSnapshot, emptyChatActivity);
  const combinedJobs = useMemo(() => [...chatJobs, ...jobs], [chatJobs, jobs]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (offline || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    setRefreshing(true);
    try {
      const snapshot = await loadGenerationSnapshot(fetch, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      setJobs(snapshot.jobs); setRefreshError(snapshot.warning); setCheckedAt(new Date());
    } catch {
      if (request.current === controller) setRefreshError("Could not refresh generations. Showing the last loaded status. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setRefreshing(false); }
    }
  }, [offline]);

  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 12_000);
    window.addEventListener("focus", update); window.addEventListener("online", update);
    window.addEventListener("amh-wallet-refresh", update); document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(initial); window.clearInterval(interval);
      window.removeEventListener("focus", update); window.removeEventListener("online", update);
      window.removeEventListener("amh-wallet-refresh", update); document.removeEventListener("visibilitychange", update);
      request.current?.abort(); request.current = null;
    };
  }, [refresh]);
  useEffect(() => { if (open) { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); } }, [open, refresh]);
  return { jobs: combinedJobs, refreshing, refreshError, checkedAt, refresh };
}
