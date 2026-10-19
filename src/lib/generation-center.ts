export type GenerationCenterJob = {
  id: string; public_id: string; project_id?: string | null; modality: string; model_id: string;
  status: string; prompt?: string; result_urls?: string[]; error_message?: string;
  charged_credits?: number | null; estimated_credits?: number | null;
  created_at?: string; updated_at?: string; completed_at?: string | null;
  source?: "chat-session"; conversation_id?: string; billing_pending?: boolean;
};

export const isActiveGeneration = (job: GenerationCenterJob) => ["queued", "submitted", "processing", "settling"].includes(job.status);

export function generationChargeLabel(job: GenerationCenterJob) {
  if (job.charged_credits != null && Number.isFinite(Number(job.charged_credits))) return `Charged ${Number(job.charged_credits).toFixed(2)} credits`;
  if (job.source === "chat-session") return job.billing_pending ? "Billing pending" : "See usage & receipts";
  if (isActiveGeneration(job) && job.estimated_credits != null && Number.isFinite(Number(job.estimated_credits))) return `Estimated ${Number(job.estimated_credits).toFixed(2)} credits`;
  return "Final charge not recorded";
}

/** Refresh existing jobs only. Never submit, retry, cancel, or alter financial records here. */
export async function loadGenerationSnapshot(fetcher: typeof fetch, signal: AbortSignal) {
  const read = async (url: string) => {
    const response = await fetcher(url, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Could not refresh generations. Showing the last loaded status.");
    return response.json();
  };
  const [recent, active] = await Promise.all([read("/api/jobs?limit=20"), read("/api/jobs?active=true&limit=100")]);
  if (!Array.isArray(recent.jobs) || !Array.isArray(active.jobs)) throw new Error("Could not refresh generations. Showing the last loaded status.");
  const activeJobs = (active.jobs as GenerationCenterJob[]).filter(isActiveGeneration);
  const refreshed: GenerationCenterJob[] = [];
  let cursor = 0, failures = 0;
  // Bound provider-status traffic; overlapping refreshes are also prevented by the hook.
  await Promise.all(Array.from({ length: Math.min(3, activeJobs.length) }, async () => {
    while (cursor < activeJobs.length) {
      const job = activeJobs[cursor++];
      try {
        const result = await read(`/api/jobs/${encodeURIComponent(job.id)}`);
        if (!result.job || result.job.id !== job.id) throw new Error("Invalid job response");
        refreshed.push(result.job);
        if (result.warning) failures++;
      } catch (error) {
        if (signal.aborted) throw error;
        failures++;
        refreshed.push(job);
      }
    }
  }));
  const merged = new Map<string, GenerationCenterJob>();
  for (const job of [...recent.jobs, ...refreshed]) merged.set(job.id, job);
  const jobs = [...merged.values()].sort((a, b) => Number(isActiveGeneration(b)) - Number(isActiveGeneration(a)) || Date.parse(b.created_at || "") - Date.parse(a.created_at || ""));
  return { jobs, warning: failures ? "Some active jobs could not refresh. Their last known status is shown; please refresh again." : "" };
}
