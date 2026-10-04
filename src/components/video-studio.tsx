"use client";
/* eslint-disable react-hooks/rules-of-hooks, react-hooks/set-state-in-effect */
import Link from "next/link";
import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
  directionForCategory,
  galleryVideoClips,
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

const formatDuration = (value: number) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function GalleryVideoCard({
  clip,
  motionAllowed,
  modalOpen,
  onOpen,
}: {
  clip: VideoStudioClip;
  motionAllowed: boolean;
  modalOpen: boolean;
  onOpen: (clip: VideoStudioClip) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!motionAllowed || modalOpen || !visible || document.visibilityState === "hidden") {
      video.pause();
      return;
    }
    video.muted = true;
    void video.play().catch(() => undefined);
  }, [modalOpen, motionAllowed, visible]);

  return (
    <article className={styles.galleryCard}>
      <button
        type="button"
        className={styles.galleryFrame}
        onClick={() => onOpen(clip)}
        aria-label={`Open ${clip.title} full video viewer`}
      >
        {motionAllowed && !failed ? (
          <video
            ref={ref}
            src={clip.gridSrc}
            poster={clip.poster}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        ) : <img src={clip.poster} alt="" loading="lazy" decoding="async" />}
        <span className={styles.galleryScrim} />
        <span className={styles.galleryMeta}>
          <b>{clip.category}</b>
          <small>{clip.title}</small>
        </span>
        <span className={styles.expandHint} aria-hidden="true">
          <CornersOut weight="bold" /> Expand
        </span>
      </button>
      <h3>{clip.title}</h3>
      <p>{clip.description}</p>
    </article>
  );
}
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
    [highlightedModel, setHighlightedModel] = useState(0),
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
    [demoError, setDemoError] = useState(false),
    [openClip, setOpenClip] = useState<VideoStudioClip | null>(null),
    [modalMuted, setModalMuted] = useState(true),
    [modalPlaying, setModalPlaying] = useState(false),
    [modalProgress, setModalProgress] = useState(0),
    [modalDuration, setModalDuration] = useState(0),
    [workspaceTab, setWorkspaceTab] = useState<"create" | "explore">("create");
  const uploadRef = useRef<HTMLInputElement>(null),
    pollToken = useRef(0),
    submissionInFlight = useRef(false),
    videoRef = useRef<HTMLVideoElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    pickerRef = useRef<HTMLDivElement>(null),
    modalRef = useRef<HTMLDivElement>(null),
    modalVideoRef = useRef<HTMLVideoElement>(null),
    creationRef = useRef<HTMLElement>(null),
    lastFocused = useRef<HTMLElement | null>(null);
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
    if (!picker) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPicker(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [picker]);
  useEffect(() => {
    if (!openClip) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenClip(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => modalRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastFocused.current?.focus();
    };
  }, [openClip]);
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
    const next = videoStudioClips.find((clip) => clip.orientation === "landscape") || videoStudioClips[0];
    if (next) {
      setDemoId(next.id);
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
    setHighlightedModel((current) => Math.min(current, Math.max(0, visibleModels.length - 1)));
  }, [visibleModels.length]);
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
  const openViewer = (clip: VideoStudioClip) => {
    setModalMuted(true);
    setModalPlaying(false);
    setModalProgress(0);
    setModalDuration(0);
    setOpenClip(clip);
  };
  const useTemplate = (clip: VideoStudioClip) => {
    const next = directionForCategory(clip.category);
    if (!next) return;
    if (
      prompt.trim() &&
      prompt.trim() !== next.prompt &&
      !window.confirm("Replace your current unsaved prompt with this template?")
    )
      return;
    setPrompt(next.prompt);
    setActive(Math.max(0, videoStudioDirections.indexOf(next)));
    setOpenClip(null);
    invalidate(`${next.category} template added. Review it before generating.`);
    window.setTimeout(() => creationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
    },
    handlePickerKeyDown = (event: ReactKeyboardEvent) => {
      if (!picker && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setPicker(true);
        return;
      }
      if (!picker) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setPicker(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedModel((index) => Math.min(index + 1, Math.max(0, visibleModels.length - 1)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedModel((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        const choice = visibleModels[highlightedModel];
        if (choice && choice.available !== false) {
          event.preventDefault();
          chooseModel(choice.id);
        }
      }
    };
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.leftColumn} ref={creationRef}>
          <header className={styles.heroCopy}>
            <div className={styles.studioHeading}>
              <span className={styles.studioMark}><Sparkle weight="fill" /></span>
              <div><span className={styles.eyebrow}>Video Studio</span><h1>Create cinematic video</h1></div>
            </div>
            <p>
              Turn an idea into a video with live models, supported controls, and secure authorization.
            </p>
            <nav className={styles.workspaceTabs} aria-label="Video Studio workspace">
              <button type="button" className={workspaceTab === "create" ? styles.tabSelected : ""} onClick={() => setWorkspaceTab("create")}>Create</button>
              <button type="button" className={workspaceTab === "explore" ? styles.tabSelected : ""} onClick={() => setWorkspaceTab("explore")}>Explore</button>
            </nav>
          </header>
          {workspaceTab === "create" && <form className={styles.inspector} onSubmit={submit}>
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
            <div className={styles.field} ref={pickerRef}>
              <label>Model</label>
              <button
                type="button"
                className={styles.modelTrigger}
                onClick={() => setPicker((v) => !v)}
                onKeyDown={handlePickerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={picker}
                aria-controls="video-model-options"
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
                  <div className={styles.modelList} id="video-model-options" role="listbox" aria-label="Available video models" onKeyDown={handlePickerKeyDown}>
                    {visibleModels.length === 0 && <p className={styles.noModels}>No video models match this search.</p>}
                    {visibleModels.map((x, index) => (
                      <button
                        key={x.id}
                        type="button"
                        disabled={x.available === false}
                        onClick={() => chooseModel(x.id)}
                        onMouseEnter={() => setHighlightedModel(index)}
                        role="option"
                        aria-selected={modelId === x.id}
                        className={highlightedModel === index ? styles.modelHighlighted : ""}
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
          </form>}
          {workspaceTab === "explore" && <section className={styles.inspiration} aria-label="Explore video templates">
            <div className={styles.inspirationHeader}><div><h2>Explore directions</h2><p>Browse the available visual directions and bring one into Create.</p></div><button type="button" className={styles.exploreBack} onClick={() => setWorkspaceTab("create")}>Back to Create</button></div>
            <div className={styles.inspirationGrid}>{galleryVideoClips.map((clip) => <GalleryVideoCard key={clip.id} clip={clip} motionAllowed={motionAllowed} modalOpen={Boolean(openClip)} onOpen={openViewer} />)}</div>
          </section>}
        </section>
        <section className={styles.rightColumn} aria-live="polite">
          {!job && (
            <div className={styles.showcase} ref={stageRef}>
              <div className={styles.mainPoster}>
                {workspaceTab === "create" ? (
                  <img src={demo?.poster || direction.poster} alt="Cinematic video workspace preview" />
                ) : demo ? (
                  <video
                    ref={videoRef}
                    key={demo.id}
                    src={demo.gridSrc}
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
                {workspaceTab === "explore" && demo && (
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
                      max={playerDuration || demo.sourceDurationSeconds || 1}
                      step=".1"
                      value={progress}
                      onChange={(e) => {
                        if (videoRef.current)
                          videoRef.current.currentTime = Number(e.target.value);
                        setProgress(Number(e.target.value));
                      }}
                    />
                    <span>{formatDuration(progress)} / {formatDuration(playerDuration || demo.sourceDurationSeconds || 0)}</span>
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
          {workspaceTab === "create" && <section className={styles.recentStrip} aria-label="Recent creations">
            <div className={styles.inspirationHeader}><div><h2>Recent creations</h2><p>Your authenticated video history will appear here.</p></div><Link href="/history">View all →</Link></div>
            <div className={styles.recentEmpty}><Sparkle weight="fill" /><span>Generate a video to see it in your workspace.</span></div>
          </section>}
        </section>
      </div>
      {openClip && (
        <div
          className={styles.viewerBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenClip(null);
          }}
        >
          <section
            className={styles.viewer}
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-viewer-title"
            tabIndex={-1}
          >
            <button type="button" className={styles.viewerClose} onClick={() => setOpenClip(null)} aria-label="Close video viewer"><X weight="bold" /></button>
            <div className={styles.viewerStage}>
              <video
                ref={modalVideoRef}
                src={openClip.fullSrc}
                poster={openClip.poster}
                muted={modalMuted}
                playsInline
                preload="metadata"
                onPlay={() => setModalPlaying(true)}
                onPause={() => setModalPlaying(false)}
                onLoadedMetadata={(event) => setModalDuration(event.currentTarget.duration)}
                onTimeUpdate={(event) => setModalProgress(event.currentTarget.currentTime)}
              />
              {!openClip.fullSrc && <div className={styles.viewerUnavailable}>The verified full-length source for this demo has not been supplied yet. Its poster remains available.</div>}
            </div>
            <div className={styles.viewerInfo}>
              <div><span>{openClip.category}</span><h2 id="video-viewer-title">{openClip.title}</h2><p>{openClip.description}</p></div>
              <div className={styles.viewerControls}>
                <button type="button" disabled={!openClip.fullSrc} onClick={() => {
                  const video = modalVideoRef.current; if (!video) return;
                  if (video.paused) void video.play().catch(() => undefined); else video.pause();
                }}>{modalPlaying ? <Pause weight="fill" /> : <Play weight="fill" />}{modalPlaying ? "Pause" : "Play"}</button>
                <input type="range" aria-label="Video position" disabled={!openClip.fullSrc} min="0" max={modalDuration || 1} step="0.1" value={modalProgress} onChange={(event) => { const next = Number(event.target.value); if (modalVideoRef.current) modalVideoRef.current.currentTime = next; setModalProgress(next); }} />
                <span>{formatDuration(modalProgress)} / {formatDuration(modalDuration)}</span>
                <button type="button" disabled={!openClip.fullSrc || !openClip.hasAudio} onClick={() => { const video = modalVideoRef.current; if (!video) return; video.muted = !video.muted; setModalMuted(video.muted); }} aria-label={modalMuted ? "Enable audio" : "Mute audio"}>{modalMuted ? <SpeakerSlash /> : <SpeakerHigh />}</button>
                <button type="button" disabled={!openClip.fullSrc} onClick={() => void modalVideoRef.current?.requestFullscreen?.()} aria-label="Fullscreen video"><CornersOut /></button>
              </div>
              <div className={styles.viewerActions}>
                {openClip.fullSrc ? <a href={openClip.fullSrc} download><DownloadSimple />Download demo</a> : <span>Full demo download pending verified source delivery.</span>}
                <button type="button" onClick={() => useTemplate(openClip)}>Use template</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
