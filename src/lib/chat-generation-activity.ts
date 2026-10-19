import type { GenerationCenterJob } from "./generation-center";

const empty: GenerationCenterJob[] = [];
export const emptyChatActivity = () => empty;

/** Ephemeral UI status only: no storage, network, provider or billing mutations. */
export function createChatActivityStore() {
  let entries: { owner: string; job: GenerationCenterJob }[] = [];
  let snapshot = empty;
  const listeners = new Set<() => void>();
  const notify = () => { snapshot = entries.map(entry => entry.job); listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish(owner: string, job: GenerationCenterJob) {
      entries = [{ owner, job }, ...entries.filter(entry => entry.job.id !== job.id)].slice(0, 12);
      notify();
    },
    removeOwner(owner: string) {
      const next = entries.filter(entry => entry.owner !== owner);
      if (next.length === entries.length) return;
      entries = next; notify();
    },
  };
}

// Mutated only by client effects. SSR always uses the stable empty snapshot.
export const chatActivity = createChatActivityStore();
