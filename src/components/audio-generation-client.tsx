"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowClockwise, CheckCircle, DownloadSimple, MusicNote, SpeakerHigh, Sparkle, Waveform } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";
import styles from "@/components/audio-studio.module.css";

type AudioMode = "music" | "sfx";
type AudioModel = {
  id: string;
  name: string;
  tier: string;
  description?: string;
  capabilities: string[];
  retail?: { flatCredits?: number; perSecondCredits?: number };
};
type GenerationJob = {
  id?: string;
  public_id?: string;
  status?: string;
  result_urls?: string[];
  error_message?: string;
  charged_credits?: number;
  estimated_credits?: number;
};

const starters = {
  music: [
    { label: "Focus flow", prompt: "Warm electronic ambient music with soft piano, subtle pulse, and an optimistic focused mood." },
    { label: "Brand lift", prompt: "Bright modern brand anthem with clean percussion, uplifting synths, and a polished finish." },
    { label: "Cinematic calm", prompt: "Gentle cinematic instrumental with strings, spacious piano, and a calm reflective atmosphere." }
  ],
  sfx: [
    { label: "Rain on glass", prompt: "Close, detailed rain droplets tapping against a window in a quiet room." },
    { label: "Soft notification", prompt: "A short, warm digital notification sound that feels refined and unobtrusive." },
    { label: "City transition", prompt: "A smooth urban transition whoosh with distant traffic texture and a clean finish." }
  ]
} as const;

const copy = {
  music: {
    label: "Generate Music",
    modelLabel: "Music model",
    promptLabel: "Music direction",
    placeholder: "Describe the mood, style, instruments, tempo, or vocal direction you want…",
    helper: "A clear direction helps the model shape the arrangement and feel.",
    emptyTitle: "Your soundtrack starts here.",
    emptyBody: "Choose a music model, describe the feeling you want, and preview the finished track here.",
    resultName: "Track ready"
  },
  sfx: {
    label: "Generate Sound Effect",
    modelLabel: "Sound-effects model",
    promptLabel: "Sound description",
    placeholder: "Describe the sound, texture, timing, and environment you want to hear…",
    helper: "Be specific about the action, material, and atmosphere for a stronger result.",
    emptyTitle: "Sound, made to order.",
    emptyBody: "Choose a sound-effects model, describe the moment, and preview the finished effect here.",
    resultName: "Sound effect ready"
  }
} as const;

export function AudioGenerationClient({ mode }: { mode: AudioMode }) {
  const [models, setModels] = useState<AudioModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [projectId, setProjectId] = useState("");
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const desiredCapability = mode === "music" ? "music" : "sound-effects";
  const details = copy[mode];
  const model = models.find((item) => item.id === modelId);
  const estimate = useMemo(() => Number(model?.retail?.flatCredits || 0), [model]);
  const resultUrl = job?.result_urls?.[0];
  const activeJob = Boolean(job && !["completed", "failed", "cancelled", "expired"].includes(job.status || ""));
  const failed = Boolean(job && ["failed", "cancelled", "expired"].includes(job.status || ""));

  useEffect(() => {
    fetch("/api/models")
      .then((response) => response.json())
      .then((data) => {
        const list = (data.models || []).filter((item: AudioModel) => item.capabilities?.includes(desiredCapability));
        setModels(list);
        setModelId((current) => current && list.some((item: AudioModel) => item.id === current) ? current : list[0]?.id || "");
      })
      .catch(() => setError("Audio models are unavailable right now."));
  }, [desiredCapability]);

  useEffect(() => {
    const sync = () => setProjectId(window.localStorage.getItem("amh-active-project") || "");
    sync();
    const listener = (event: Event) => setProjectId((event as CustomEvent<string>).detail || "");
    window.addEventListener("amh-project-change", listener);
    return () => window.removeEventListener("amh-project-change", listener);
  }, []);

  async function poll(id: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.job) continue;
      setJob(data.job);
      if (["completed", "failed", "cancelled", "expired"].includes(data.job.status)) return;
    }
    setError("This generation is still running. You can follow it in the Generation Center.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!modelId || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setJob(null);
    try {
      const response = await fetch("/api/generations/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          projectId: projectId || undefined,
          modelId,
          prompt: prompt.trim(),
          confirmedCost: true
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.job) throw new Error(data.error || "Generation request failed.");
      setJob(data.job);
      void poll(data.job.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Generation request failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.workspace}>
    <form className={styles.controls} onSubmit={submit}>
      <div className={styles.cardHead}>
        <span className={styles.headIcon}>{mode === "music" ? <MusicNote weight="fill" /> : <SpeakerHigh weight="fill" />}</span>
        <div><h2>{details.label}</h2><p>{mode === "music" ? "Turn a written direction into original music." : "Create precise, ready-to-use sound from a written moment."}</p></div>
        <i>{mode === "music" ? "02" : "03"}</i>
      </div>

      <label className={styles.field}>
        <span>{details.modelLabel}</span>
        <PremiumSelect className={styles.select} value={modelId} onChange={setModelId} options={models.map((item) => ({ value: item.id, label: `${item.name} · ${item.tier}` }))} aria-label={details.modelLabel} />
        {model?.description && <small>{model.description}</small>}
      </label>

      <label className={styles.field}>
        <span>{details.promptLabel}</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={20_000} placeholder={details.placeholder} />
        <small>{details.helper}</small>
      </label>

      <div className={styles.starterGroup}>
        <span>Start with a direction</span>
        <div>{starters[mode].map((starter) => <button key={starter.label} type="button" onClick={() => setPrompt(starter.prompt)}>{starter.label}</button>)}</div>
      </div>

      <div className={styles.costRow}>
        <span className={styles.costIcon}><Waveform /></span>
        <span><small>Estimated cost</small><b>~ {estimate.toFixed(2)} credits</b></span>
        {projectId && <em>Project connected</em>}
      </div>
      <button className={styles.generate} disabled={busy || !modelId || !prompt.trim()}><Sparkle weight="fill" />{busy ? "Submitting…" : details.label}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>

    <section className={styles.preview} aria-label={`${mode === "music" ? "Music" : "Sound effects"} preview`}>
      <div className={styles.previewHead}><span><i className={activeJob ? styles.live : ""} />{activeJob ? "Generating" : resultUrl ? details.resultName : "Audio preview"}</span><small>{model?.name || "Choose a model"}</small></div>
      <p>{activeJob ? "Your request is processing. You can safely keep working while it completes." : resultUrl ? "Listen, download, or create another variation." : "Your generated audio will appear here when it is ready."}</p>
      <div className={`${styles.waveArea} ${activeJob ? styles.isBusy : ""}`}><div className={styles.waveBars}>{Array.from({ length: 38 }, (_, index) => <i key={index} />)}</div>{activeJob && <span>Creating your audio…</span>}</div>
      {resultUrl ? <div className={styles.resultPlayer}><audio controls src={resultUrl} /><div><a className={styles.secondaryAction} href={resultUrl} download><DownloadSimple />Download</a><button className={styles.secondaryAction} type="button" onClick={() => setJob(null)}><ArrowClockwise />New variation</button></div><small>Ready · Charged {Number(job?.charged_credits || job?.estimated_credits || estimate).toFixed(2)} credits</small></div> : failed ? <div className={styles.failure}><b>{job?.status === "cancelled" ? "Generation cancelled" : "Generation could not complete"}</b><p>{job?.error_message || "Your credits are handled automatically. Try again with the same direction."}</p><button className={styles.secondaryAction} type="button" onClick={() => setJob(null)}><ArrowClockwise />Try again</button></div> : <div className={styles.emptyPreview}><span>{mode === "music" ? <MusicNote weight="fill" /> : <SpeakerHigh weight="fill" />}</span><h2>{details.emptyTitle}</h2><p>{details.emptyBody}</p><small>MODEL → DIRECTION → GENERATE</small></div>}
      <div className={styles.qualityStrip}><span className={styles.qualityIcon}><CheckCircle weight="fill" /></span><div><b>Built for your workflow.</b><p>{mode === "music" ? "Use a concise direction for a stronger musical result." : "Describe the sound and setting clearly for a more useful effect."}</p></div></div>
    </section>
  </div>;
}
