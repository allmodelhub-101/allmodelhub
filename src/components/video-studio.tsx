"use client";
/* eslint-disable react-hooks/rules-of-hooks, react-hooks/set-state-in-effect */
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  CaretDown,
  CornersOut,
  DownloadSimple,
  FileImage,
  LinkSimple,
  MagnifyingGlass,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";
import {
  clipsForCategory,
  videoStudioClips,
  videoStudioDirections,
  type VideoStudioClip,
} from "@/lib/video-studio-media";
import styles from "@/components/video-studio-v2.module.css";
type Schema = {
  inputModes?: string[];
  aspectRatios?: string[];
  durationOptions?: number[];
  resolutionOptions?: string[];
  maxReferences?: number;
  nativeAudio?: boolean;
};
type Model = {
  id: string;
  name: string;
  providerFamily?: string;
  tier: string;
  modality: string;
  description: string;
  capabilities: string[];
  available?: boolean;
  availabilityReason?: string | null;
  uiSchema?: Schema;
};
type Ref = { id: string; name: string; previewUrl: string };
type Job = {
  id: string;
  status?: string;
  result_urls?: string[];
  error_message?: string;
  charged_credits?: number;
  model_id?: string;
  modality?: string;
  duration?: number;
  aspect_ratio?: string;
};
export type VideoStudioFixtureState =
  | "idle"
  | "queued"
  | "submitted"
  | "processing"
  | "settling"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
const fixtureModels: Model[] = [
  {
    id: "fixture-minimax-h3-lite",
    name: "MiniMax H3 Lite",
    providerFamily: "MiniMax",
    tier: "budget",
    modality: "video",
    description: "Representative development fixture model.",
    capabilities: ["text-to-video", "image-to-video"],
    available: true,
    uiSchema: {
      inputModes: ["text", "image"],
      durationOptions: [5, 10],
      aspectRatios: ["16:9", "9:16"],
      resolutionOptions: ["720p"],
      maxReferences: 1,
    },
  },
];
const fixtureJob = (state: Exclude<VideoStudioFixtureState, "idle">): Job => ({
  id: "development-fixture-job",
  status: state,
  model_id: "fixture-minimax-h3-lite",
  duration: 5,
  aspect_ratio: "16:9",
  ...(state === "completed"
    ? {
        result_urls: ["/video-studio/demo/previews/cinematic-monochrome.mp4"],
        charged_credits: 12.5,
      }
    : {}),
  ...( ["failed", "cancelled", "expired"].includes(state)
    ? { error_message: "Development fixture: no generation was submitted." }
    : {}),
});
const unavailable = (reason?: string | null) =>
  ({
    provider_route_unavailable: "Provider route is not available.",
    billing_authorization_pending:
      "Billing authorization is still being configured.",
    billing_authorization_incomplete: "Billing authorization is incomplete.",
  })[reason || ""] || "This model is currently unavailable.";
const terminal = (job?: Job | null) =>
  Boolean(
    job &&
      ["completed", "failed", "cancelled", "expired"].includes(
        job.status || "",
      ),
  );
const jobCopy = (status?: string) =>
  status === "queued"
    ? [
        "Queued",
        "Your request is safely queued.",
        "The provider has not started it yet.",
      ]
    : status === "submitted"
      ? [
          "Submitted",
          "Your request was accepted.",
          "Waiting for the provider to begin processing.",
        ]
      : status === "settling"
        ? [
            "Finalizing",
            "Finishing output and billing.",
            "Billing is finalizing; no charge is shown until settlement is confirmed.",
          ]
        : [
            "Processing",
            "Creating your video.",
            "The provider is working. Progress is not reported for this job.",
          ];
export function VideoStudio({
  fixtureState,
  fixtureTheme,
}: {
  fixtureState?: VideoStudioFixtureState;
  fixtureTheme?: "light" | "dark";
} = {}) {
  const fixture = Boolean(fixtureState),
    [models, setModels] = useState<Model[]>(fixture ? fixtureModels : []),
    [modelId, setModelId] = useState(fixture ? fixtureModels[0].id : ""),
    [prompt, setPrompt] = useState(""),
    [duration, setDuration] = useState(5),
    [aspect, setAspect] = useState("16:9"),
    [resolution, setResolution] = useState(""),
    [nativeAudio, setNativeAudio] = useState(false),
    [mode, setMode] = useState<"text" | "image">("text"),
    [refs, setRefs] = useState<Ref[]>([]),
    [projectId, setProjectId] = useState(""),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [job, setJob] = useState<Job | null>(
      fixtureState && fixtureState !== "idle" ? fixtureJob(fixtureState) : null,
    ),
    [copied, setCopied] = useState(false),
    [active, setActive] = useState(0),
    [demoId, setDemoId] = useState<string | null>(null),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true),
    [progress, setProgress] = useState(0),
    [playerDuration, setPlayerDuration] = useState(0),
    [visible, setVisible] = useState(true),
    [motionAllowed, setMotionAllowed] = useState(false),
    [demoError, setDemoError] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null),
    pollToken = useRef(0),
    submissionInFlight = useRef(false),
    videoRef = useRef<HTMLVideoElement>(null),
    stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fixtureTheme) return;
    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = fixtureTheme;
    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    };
  }, [fixtureTheme]);
  useEffect(() => {
    if (fixture) return;
    const c = new AbortController();
    fetch("/api/models", { signal: c.signal })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.models || []).filter(
          (x: Model) => x.modality === "video" && x.id !== "flashvsr",
        );
        setModels(list);
        setModelId((v) =>
          v && list.some((x: Model) => x.id === v)
            ? v
            : list.find((x: Model) => x.available !== false)?.id ||
              list[0]?.id ||
              "",
        );
      })
      .catch(
        () =>
          !c.signal.aborted &&
          setError("Video models are unavailable right now."),
      );
    return () => c.abort();
  }, [fixture]);
  useEffect(() => {
    const sync = () =>
      setProjectId(localStorage.getItem("amh-active-project") || "");
    sync();
    window.addEventListener("amh-project-change", sync);
    return () => window.removeEventListener("amh-project-change", sync);
  }, []);
  useEffect(() => {
    const connection = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    setMotionAllowed(
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !connection.connection?.saveData,
    );
    const last = localStorage.getItem("amh-video-demo"),
      choices = videoStudioClips.filter((x) => x.id !== last),
      next = (choices.length ? choices : videoStudioClips)[
        Math.floor(
          Math.random() *
            (choices.length ? choices.length : videoStudioClips.length),
        )
      ];
    if (next) {
      setDemoId(next.id);
      localStorage.setItem("amh-video-demo", next.id);
    }
  }, []);
  useEffect(() => {
    if (!stageRef.current) return;
    const o = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.2,
    });
    o.observe(stageRef.current);
    return () => o.disconnect();
  }, []);
  const model = models.find((x) => x.id === modelId),
    schema = model?.uiSchema || {},
    supportsImage =
      (schema.inputModes || ["text"]).includes("image") ||
      model?.capabilities.includes("image-to-video") === true,
    maxRefs = Math.max(0, schema.maxReferences ?? (supportsImage ? 1 : 0)),
    durations = schema.durationOptions?.length ? schema.durationOptions : [5],
    aspects = schema.aspectRatios?.length ? schema.aspectRatios : ["16:9"],
    resolutions = schema.resolutionOptions || [],
    effectiveDuration = durations.includes(duration) ? duration : durations[0],
    effectiveAspect = aspects.includes(aspect) ? aspect : aspects[0],
    effectiveResolution = resolutions.includes(resolution)
      ? resolution
      : resolutions[0] || "",
    generating = !!job && !terminal(job),
    direction = videoStudioDirections[active],
    demo = videoStudioClips.find((x) => x.id === demoId) || null,
    visibleModels = useMemo(
      () =>
        models.filter((x) =>
          `${x.name} ${x.providerFamily || ""} ${x.tier}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      [models, query],
    );
  useEffect(() => {
    const v = videoRef.current;
    if (
      !v ||
      !demo ||
      job ||
      !motionAllowed ||
      !visible ||
      document.visibilityState === "hidden"
    ) {
      v?.pause();
      return;
    }
    v.muted = muted;
    void v.play().catch(() => setPlaying(false));
  }, [demo, job, motionAllowed, visible, muted]);
  useEffect(() => {
    const f = () =>
      document.visibilityState === "hidden" && videoRef.current?.pause();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  const invalidate = (message = "") => {
    setConfirmed(false);
    setError("");
    setNotice(message);
  };
  const useDirection = (i: number) => {
    const nextDirection = videoStudioDirections[i],
      clips = clipsForCategory(nextDirection.category),
      nextClip = clips.find((clip) => clip.id !== demoId) || clips[0];
    setActive(i);
    setPrompt(nextDirection.prompt);
    setDemoError(false);
    setProgress(0);
    setDemoId(nextClip?.id || null);
    if (nextClip) localStorage.setItem("amh-video-demo", nextClip.id);
    invalidate(`${nextDirection.category} direction added.`);
  };
  const preview = (clip: VideoStudioClip) => {
    if (job) return;
    setDemoError(false);
    setMuted(true);
    setDemoId(clip.id);
    setActive(
      videoStudioDirections.findIndex((x) => x.category === clip.category),
    );
    localStorage.setItem("amh-video-demo", clip.id);
  };
  const chooseModel = (id: string) => {
    const next = models.find((x) => x.id === id);
    if (!next) return;
    setModelId(id);
    setDuration(next.uiSchema?.durationOptions?.[0] || 5);
    setAspect(next.uiSchema?.aspectRatios?.[0] || "16:9");
    setResolution(next.uiSchema?.resolutionOptions?.[0] || "");
    if (!(next.uiSchema?.inputModes || ["text"]).includes("image"))
      setMode("text");
    setPicker(false);
    invalidate("Model settings were updated to match its supported workflow.");
  };
  async function upload(file: File) {
    if (!file.type.startsWith("image/") || !supportsImage || !maxRefs) {
      setError("This model does not support image-to-video.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (projectId) form.set("projectId", projectId);
      const r = await fetch("/api/files", { method: "POST", body: form }),
        d = await r.json().catch(() => ({}));
      if (!r.ok || !d.file?.id)
        throw new Error(d.error || "Reference upload failed.");
      setRefs((v) =>
        [
          ...v,
          {
            id: d.file.id,
            name: d.file.name || file.name,
            previewUrl: URL.createObjectURL(file),
          },
        ].slice(0, maxRefs),
      );
      setMode("image");
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reference upload failed.");
    } finally {
      setUploading(false);
    }
  }
  async function poll(id: string) {
    const token = ++pollToken.current;
    let misses = 0;
    for (let i = 0; i < 120 && token === pollToken.current; i++) {
      await new Promise((r) => setTimeout(r, Math.min(12000, 4000 + i * 100)));
      if (document.visibilityState === "hidden") continue;
      const r = await fetch(`/api/jobs/${id}`, { cache: "no-store" }).catch(
        () => null,
      );
      if (!r?.ok) {
        misses += 1;
        if (misses === 3)
          setNotice(
            "Connection interrupted. This job remains safe; reopen Generation history to continue monitoring.",
          );
        continue;
      }
      misses = 0;
      const d = await r.json().catch(() => ({}));
      if (d.job) {
        setJob(d.job);
        if (terminal(d.job)) return;
      }
    }
    if (token === pollToken.current)
      setNotice(
        "This job is still active. Monitoring continues in Generation history.",
      );
  }
  useEffect(() => {
    if (fixture) return;
    let live = true;
    fetch("/api/jobs?active=true&limit=12")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const running = d?.jobs?.find((x: Job) => x.modality === "video");
        if (live && running?.id) {
          setJob(running);
          void poll(running.id);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      pollToken.current += 1;
    };
  }, [fixture]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submissionInFlight.current) return;
    if (!model || model.available === false)
      return setError(unavailable(model?.availabilityReason));
    if (!prompt.trim())
      return setError("Describe the video you want to create.");
    if (mode === "image" && !refs.length)
      return setError("Add a starting image before using Image to Video.");
    if (!confirmed)
      return setError("Confirm the authorization before generating.");
    if (fixture) {
      setJob(fixtureJob("queued"));
      return;
    }
    submissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/generations/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            projectId: projectId || undefined,
            modelId: model.id,
            prompt: prompt.trim(),
            duration: effectiveDuration,
            resolution: effectiveResolution || undefined,
            aspectRatio: effectiveAspect,
            imageFileIds: mode === "image" ? refs.map((x) => x.id) : [],
            ...(schema.nativeAudio ? { nativeAudio } : {}),
            confirmedCost: true,
          }),
        }),
        d = await r.json().catch(() => ({}));
      if (!r.ok || !d.job)
        throw new Error(d.error || "Generation request failed.");
      setJob(d.job);
      void poll(d.job.id);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Generation request failed.");
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }
  const reset = () => {
      pollToken.current += 1;
      setJob(null);
      setConfirmed(false);
      setError("");
      setNotice("Ready to create another video.");
    },
    resultUrl = job?.result_urls?.[0],
    hasFinalCharge =
      job?.status === "completed" && typeof job.charged_credits === "number",
    [jobLabel, jobTitle, jobDetail] = jobCopy(job?.status),
    toggle = async () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        try {
          await v.play();
        } catch {
          setDemoError(true);
        }
      } else v.pause();
    },
    toggleMute = () => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !v.muted;
      setMuted(v.muted);
      if (!v.muted) void v.play().catch(() => undefined);
    },
    fullscreen = () => {
      const e = stageRef.current;
      if (!e) return;
      void (document.fullscreenElement
        ? document.exitFullscreen?.()
        : e.requestFullscreen?.());
    };
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.leftColumn}>
          <header className={styles.heroCopy}>
            <span className={styles.eyebrow}>AI Video Studio</span>
            <h1>
              Turn your imagination into <em>cinematic video</em>
              <i>✦</i>
            </h1>
            <p>
              Create stunning videos from text or images using state-of-the-art
              AI models. Professional quality, limitless possibilities.
            </p>
            <div className={styles.benefits}>
              <span>
                <Play weight="fill" />
                Cinematic quality<small>Studio-grade visuals</small>
              </span>
              <span>
                <Sparkle weight="fill" />
                Lightning fast<small>From idea to video</small>
              </span>
              <span>
                <Sparkle weight="fill" />
                Endless styles<small>Realistic, cinematic, anime + more</small>
              </span>
            </div>
          </header>
          <form className={styles.inspector} onSubmit={submit}>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={mode === "text" ? styles.selected : ""}
                onClick={() => {
                  setMode("text");
                  invalidate();
                }}
              >
                <Sparkle weight="fill" />
                Text to Video
              </button>
              <button
                type="button"
                className={mode === "image" ? styles.selected : ""}
                disabled={!supportsImage}
                onClick={() => supportsImage && setMode("image")}
              >
                <FileImage />
                Image to Video
              </button>
            </div>
            <div className={styles.field}>
              <label>Model</label>
              <button
                type="button"
                className={styles.modelTrigger}
                onClick={() => setPicker((v) => !v)}
              >
                <span>
                  <b>{model?.name || "Choose a model"}</b>
                  <small>
                    {model
                      ? `${model.providerFamily || "AI provider"} · ${model.tier}`
                      : "Loading live availability…"}
                  </small>
                </span>
                <CaretDown />
              </button>
              {picker && (
                <div className={styles.modelPicker}>
                  <div className={styles.search}>
                    <MagnifyingGlass />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search live video models"
                    />
                  </div>
                  <div className={styles.modelList}>
                    {visibleModels.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        disabled={x.available === false}
                        onClick={() => chooseModel(x.id)}
                      >
                        <span>
                          <b>{x.name}</b>
                          <small>
                            {x.providerFamily || "AI provider"} · {x.tier}
                          </small>
                        </span>
                        <strong>
                          {x.available === false
                            ? unavailable(x.availabilityReason)
                            : "Available"}
                        </strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <small>
                {model?.available === false
                  ? unavailable(model.availabilityReason)
                  : model?.description ||
                    "Live availability and supported settings are loaded securely."}
              </small>
            </div>
            <div className={styles.field}>
              <label>Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  invalidate();
                }}
                placeholder="Describe your video scene…"
                maxLength={20000}
              />
              <small>{prompt.length.toLocaleString()} / 20,000</small>
            </div>
            <div className={styles.promptChips}>
              {videoStudioDirections.map((x, i) => (
                <button
                  type="button"
                  key={x.category}
                  onClick={() => useDirection(i)}
                >
                  {x.category.replace("Social / ", "")}
                </button>
              ))}
            </div>
            {mode === "image" && (
              <div className={styles.referenceBox}>
                <b>Starting frame</b>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) void upload(f);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  className={styles.uploadButton}
                  disabled={uploading || refs.length >= maxRefs}
                  onClick={() => uploadRef.current?.click()}
                >
                  <FileImage />
                  {uploading ? "Uploading…" : "Add starting image"}
                </button>
                {refs.map((x) => (
                  <div className={styles.reference} key={x.id}>
                    <img src={x.previewUrl} alt="Selected starting reference" />
                    <b>{x.name}</b>
                    <button
                      type="button"
                      onClick={() =>
                        setRefs((v) => v.filter((y) => y.id !== x.id))
                      }
                    >
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.settings}>
              <label>
                Duration
                <PremiumSelect
                  value={String(effectiveDuration)}
                  onChange={(v) => {
                    setDuration(Number(v));
                    invalidate();
                  }}
                  options={durations.map((v) => ({
                    value: String(v),
                    label: `${v} seconds`,
                  }))}
                />
              </label>
              <label>
                Aspect ratio
                <PremiumSelect
                  value={effectiveAspect}
                  onChange={(v) => {
                    setAspect(v);
                    invalidate();
                  }}
                  options={aspects.map((v) => ({ value: v, label: v }))}
                />
              </label>
            </div>
            <details
              className={styles.advanced}
              open={advanced}
              onToggle={(e) => setAdvanced(e.currentTarget.open)}
            >
              <summary>
                Advanced settings <span>{advanced ? "Hide" : "Customize"}</span>
              </summary>
              <div>
                {resolutions.length > 0 && (
                  <label>
                    Resolution
                    <PremiumSelect
                      value={effectiveResolution}
                      onChange={setResolution}
                      options={resolutions.map((v) => ({ value: v, label: v }))}
                    />
                  </label>
                )}
                {schema.nativeAudio && (
                  <label>
                    <input
                      type="checkbox"
                      checked={nativeAudio}
                      onChange={(e) => setNativeAudio(e.target.checked)}
                    />
                    Generate native audio when supported
                  </label>
                )}
              </div>
            </details>
            <div className={styles.billing}>
              <span>
                <small>Usage-based billing</small>
                <b>Authorized securely at submission</b>
                <em>Final credits settle from actual provider usage.</em>
              </span>
              {projectId && <small>Project connected</small>}
            </div>
            <label className={styles.confirm}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I authorize this paid generation. The final usage is settled
              securely.
            </label>
            <button
              className={styles.generate}
              disabled={
                submitting ||
                generating ||
                !model ||
                model.available === false ||
                !prompt.trim() ||
                !confirmed
              }
            >
              <Sparkle weight="fill" />
              {submitting
                ? "Submitting…"
                : generating
                  ? "Generation in progress"
                  : "Generate Video"}{" "}
              <span>→</span>
            </button>
            {error && <p className={styles.error}>{error}</p>}
            {notice && <p className={styles.notice}>{notice}</p>}
          </form>
        </section>
        <section className={styles.rightColumn} aria-live="polite">
          {!job && (
            <div className={styles.showcase} ref={stageRef}>
              <div className={styles.mainPoster}>
                {demo ? (
                  <video
                    ref={videoRef}
                    key={demo.id}
                    src={demo.src}
                    poster={demo.poster}
                    muted={muted}
                    loop
                    playsInline
                    preload="metadata"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onLoadedMetadata={(e) =>
                      setPlayerDuration(e.currentTarget.duration)
                    }
                    onLoadedData={() => setDemoError(false)}
                    onTimeUpdate={(e) =>
                      setProgress(e.currentTarget.currentTime)
                    }
                    onError={() => setDemoError(true)}
                  />
                ) : (
                  <img src={direction.poster} alt={direction.category} />
                )}
                <div className={styles.posterShade} />
                {demo && (
                  <div className={styles.playerControls}>
                    <button
                      type="button"
                      onClick={() => void toggle()}
                      aria-label={playing ? "Pause preview" : "Play preview"}
                    >
                      {playing ? (
                        <Pause weight="fill" />
                      ) : (
                        <Play weight="fill" />
                      )}
                    </button>
                    <input
                      type="range"
                      aria-label="Preview progress"
                      min="0"
                      max={playerDuration || demo.durationSeconds}
                      step=".1"
                      value={progress}
                      onChange={(e) => {
                        if (videoRef.current)
                          videoRef.current.currentTime = Number(e.target.value);
                        setProgress(Number(e.target.value));
                      }}
                    />
                    <span>
                      {Math.floor(progress)}:
                      {String(
                        Math.max(
                          0,
                          Math.floor(
                            (playerDuration || demo.durationSeconds) - progress,
                          ),
                        ),
                      ).padStart(2, "0")}
                    </span>
                    {demo.hasAudio && (
                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={muted ? "Unmute preview" : "Mute preview"}
                      >
                        {muted ? <SpeakerSlash /> : <SpeakerHigh />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={fullscreen}
                      aria-label="Fullscreen preview"
                    >
                      <CornersOut />
                    </button>
                  </div>
                )}
                {demoError && (
                  <p className={styles.playerError}>
                    Preview unavailable. The poster remains available.
                  </p>
                )}
                <div className={styles.posterCaption}>
                  <b>{demo?.description || direction.category}</b>
                  <span>
                    {demo
                      ? "Demo preview · muted by default"
                      : "Static direction poster"}
                  </span>
                </div>
              </div>
              {[
                ["portrait", "Portrait"],
                ["cinematic", "Cinematic"],
              ].map(([className, category]) => {
                const clip = clipsForCategory(
                  category as VideoStudioClip["category"],
                )[0];
                return (
                  <button
                    type="button"
                    key={category}
                    className={`${styles.floatCard} ${styles[className]}`}
                    onClick={() => clip && preview(clip)}
                  >
                    <img
                      src={clip?.poster || direction.poster}
                      alt={category}
                      decoding="async"
                    />
                    <b>{category}</b>
                  </button>
                );
              })}
              <div className={styles.sideCards}>
                <button
                  type="button"
                  onClick={() => useDirection(3)}
                  aria-label="Use Nature direction"
                >
                  <img
                    src={videoStudioDirections[3].poster}
                    alt="Nature"
                    decoding="async"
                  />
                  <b>Nature</b>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clip = clipsForCategory("Sci-Fi")[0];
                    if (clip) preview(clip);
                  }}
                >
                  <img
                    src={
                      clipsForCategory("Sci-Fi")[0]?.poster ||
                      videoStudioDirections[4].poster
                    }
                    alt="Sci-Fi"
                    decoding="async"
                  />
                  <b>Sci-Fi</b>
                </button>
              </div>
            </div>
          )}
          {generating && (
            <div className={styles.jobState}>
              <Sparkle weight="fill" />
              <span className={styles.jobStatus}>{jobLabel}</span>
              <h2>{jobTitle}</h2>
              <p>{jobDetail}</p>
              <div
                className={styles.indeterminate}
                role="progressbar"
                aria-label={`${jobLabel} video generation`}
                aria-valuetext="Progress is not reported by the provider"
              >
                <i />
              </div>
              <small>
                This provider does not report a reliable percentage or ETA.
              </small>
              <Link href="/history">Monitor in Generation history</Link>
            </div>
          )}
          {job &&
            ["failed", "cancelled", "expired"].includes(job.status || "") && (
              <div className={styles.jobState}>
                <span className={styles.jobStatus}>Needs attention</span>
                <h2>Your video was not completed.</h2>
                <p>
                  {job.error_message ||
                    "The provider could not complete this request."}
                </p>
                <div className={styles.jobActions}>
                  <Link href="/history">Open Generation history</Link>
                  <button type="button" onClick={reset}>Create another</button>
                </div>
              </div>
            )}
          {job?.status === "completed" && (
            <div className={styles.result}>
              {resultUrl ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  src={resultUrl}
                />
              ) : (
                <div className={styles.jobState}>
                  <h2>Your result is ready.</h2>
                  <p>The output is available in Generation history.</p>
                </div>
              )}
              <div className={styles.resultFooter}>
                <span>
                  <b>Generation details</b>
                  <small>
                    {job.model_id}
                    {job.duration && job.aspect_ratio
                      ? ` · ${job.duration}s · ${job.aspect_ratio}`
                      : ""}
                  </small>
                  <small>
                    {hasFinalCharge
                      ? `${Number(job.charged_credits).toFixed(2)} credits charged`
                      : "Billing finalizing"}
                  </small>
                </span>
                <div>
                  {resultUrl && (
                    <a href={resultUrl} download>
                      <DownloadSimple />
                      Download
                    </a>
                  )}
                  {resultUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard?.writeText(resultUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                    >
                      <LinkSimple />
                      {copied ? "Link copied" : "Copy link"}
                    </button>
                  )}
                  <Link href="/history">History</Link>
                  <button type="button" onClick={reset}>
                    <ArrowClockwise />
                    Create another
                  </button>
                </div>
              </div>
            </div>
          )}
          <section className={styles.inspiration}>
            <div className={styles.inspirationHeader}>
              <div>
                <h2>Get inspired</h2>
                <p>
                  Explore cinematic demo previews and use a direction to start
                  creating your own.
                </p>
              </div>
              <Link href="/templates">View all templates →</Link>
            </div>
            <div className={styles.inspirationGrid}>
              {videoStudioDirections.map((x, i) => {
                const clips = clipsForCategory(x.category),
                  clip = clips.find((c) => c.id === demoId) || clips[0];
                return (
                  <article
                    key={x.category}
                    className={i === active ? styles.activeCard : ""}
                    onMouseEnter={() => clip && preview(clip)}
                  >
                    <span>
                      <img
                        src={clip?.poster || x.poster}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      {clip && (
                        <button
                          type="button"
                          onClick={() => preview(clip)}
                          aria-label={`Preview ${x.category}`}
                        >
                          <Play weight="fill" />
                        </button>
                      )}
                      <b>{x.category}</b>
                    </span>
                    <strong>{x.title}</strong>
                    <small>{x.description}</small>
                    <div>
                      <button type="button" onClick={() => useDirection(i)}>
                        Use direction
                      </button>
                      {clip && (
                        <button type="button" onClick={() => preview(clip)}>
                          Preview
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
