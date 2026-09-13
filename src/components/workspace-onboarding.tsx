"use client";

import { ArrowLeft, ArrowRight, Briefcase, ChatCircle, Check, GraduationCap, ImageSquare, Megaphone, RocketLaunch, Sparkle, VideoCamera, Waveform, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Workspace = "chat" | "images" | "video" | "audio";
type Profile = { goal: string; workspace: Workspace; source: string };
type Phase = "setup" | "ready" | "tour";
const STORAGE_KEY = "amh-onboarding-v2";
const routes: Record<Workspace, string> = { chat: "/chat", images: "/images", video: "/video", audio: "/audio" };

const questions = [
  { eyebrow: "Make it yours", title: "What brings you to All Model Hub?", body: "We’ll tune your starting experience around the work you want to do most.", field: "goal" as const, options: [
    { value: "work", label: "Work & business", hint: "Documents, strategy and client work", icon: Briefcase }, { value: "content", label: "Content & marketing", hint: "Campaigns, visuals and social content", icon: Megaphone }, { value: "learn", label: "Learning & research", hint: "Explore, compare and understand", icon: GraduationCap }, { value: "explore", label: "Explore AI", hint: "Try the best models in one place", icon: Sparkle }
  ]},
  { eyebrow: "Choose your starting point", title: "What would you like to create first?", body: "You can move between every studio at any time—this only sets your first destination.", field: "workspace" as const, options: [
    { value: "chat", label: "Chat & reason", hint: "Write, research, code and solve", icon: ChatCircle }, { value: "images", label: "Create images", hint: "Generate or transform visuals", icon: ImageSquare }, { value: "video", label: "Generate video", hint: "Turn prompts and frames into motion", icon: VideoCamera }, { value: "audio", label: "Produce audio", hint: "Create voice and sound", icon: Waveform }
  ]},
  { eyebrow: "One last thing", title: "How did you discover us?", body: "This helps us understand which communities to support. It won’t change your access.", field: "source" as const, options: [
    { value: "search", label: "Search", hint: "Google, Bing or another search engine", icon: RocketLaunch }, { value: "social", label: "Social media", hint: "YouTube, TikTok, Instagram or X", icon: Megaphone }, { value: "friend", label: "Friend or colleague", hint: "Someone recommended All Model Hub", icon: ChatCircle }, { value: "other", label: "Something else", hint: "A community, article or event", icon: Sparkle }
  ]}
];

const tourSteps = [
  { selector: '.sidebar-link[href="/chat"]', title: "Create in focused studios", body: "Chat, Image, Video and Audio each have a purpose-built workspace. Your projects and credits stay connected everywhere." },
  { selector: '.sidebar-link[href="/models"]', title: "Choose the intelligence", body: "Open Models to compare capabilities and pricing. Use Auto when you want All Model Hub to choose the best fit for you." },
  { selector: ".global-project", title: "Keep every job organized", body: "Select a project here before creating. Conversations, files and generations remain grouped around the same goal." },
  { selector: ".wallet-chip", title: "Know the cost before you create", body: "Your live PKR credit balance is always visible. High-cost generations show an estimate and ask for confirmation first." }
];

function save(profile: Profile, state: "complete" | "tour") { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, state, completedAt: new Date().toISOString() })); }

export function WorkspaceOnboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState(0);
  const [tourStep, setTourStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({ goal: "", workspace: "chat", source: "" });
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true); }, 450); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });
  useEffect(() => { if (!open || phase !== "tour") return; const update = () => setSpotlight(document.querySelector(tourSteps[tourStep].selector)?.getBoundingClientRect() || null); update(); window.addEventListener("resize", update); window.addEventListener("scroll", update, true); return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); }; }, [open, phase, tourStep]);

  const current = questions[step];
  const selected = profile[current?.field] || "";
  const workspaceLabel = useMemo(() => ({ chat: "Chat & reason", images: "Image Studio", video: "Video Studio", audio: "Audio Studio" }[profile.workspace]), [profile.workspace]);
  function finish(destination?: string) { save(profile, "complete"); setOpen(false); if (destination) router.push(destination); }
  function choose(value: string) { setProfile((previous) => ({ ...previous, [current.field]: value } as Profile)); }
  function continueSetup() { if (step < questions.length - 1) setStep((value) => value + 1); else setPhase("ready"); }
  function startTour() { save(profile, "tour"); setTourStep(0); setPhase("tour"); }
  if (!open) return null;

  if (phase === "tour") {
    const item = tourSteps[tourStep];
    const style = spotlight ? { left: Math.max(10, spotlight.left - 7), top: Math.max(10, spotlight.top - 7), width: spotlight.width + 14, height: spotlight.height + 14 } : undefined;
    return <div className="onboarding-tour-layer" role="dialog" aria-modal="true" aria-label="Workspace tour"><div className="onboarding-spotlight" style={style} /><section className={`onboarding-tour-card tour-position-${tourStep}`}><div className="tour-card-head"><span>Guided tour · {tourStep + 1}/{tourSteps.length}</span><button type="button" onClick={() => finish()} aria-label="Stop tour"><X size={18} /></button></div><div className="tour-card-icon"><Sparkle size={22} weight="fill" /></div><h2>{item.title}</h2><p>{item.body}</p>{tourStep === 1 && <div className="tour-model-row"><span>Auto</span><span>GPT</span><span>Claude</span><span>Gemini</span></div>}<div className="onboarding-actions"><button className="btn btn-ghost" type="button" onClick={() => finish()}>Stop tour</button>{tourStep > 0 && <button className="btn" type="button" onClick={() => setTourStep((value) => value - 1)}>Back</button>}<button className="btn btn-primary" type="button" onClick={() => tourStep === tourSteps.length - 1 ? finish(routes[profile.workspace]) : setTourStep((value) => value + 1)}>{tourStep === tourSteps.length - 1 ? `Open ${workspaceLabel}` : "Next"}<ArrowRight size={16} /></button></div></section></div>;
  }

  if (phase === "ready") return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><section className="onboarding-panel onboarding-ready"><div className="onboarding-ambient" aria-hidden="true"><span /><span /><span /></div><button className="onboarding-close" type="button" onClick={() => finish()} aria-label="Close onboarding"><X size={18} /></button><div className="onboarding-success"><Check size={30} weight="bold" /></div><span className="kicker">Your workspace is ready</span><h2 id="onboarding-title">Start with {workspaceLabel}.</h2><p>We’ll keep the rest of All Model Hub one click away. Would you like a 60-second guided tour before you begin?</p><div className="onboarding-ready-summary"><span><Check size={14} /> Personalized starting point</span><span><Check size={14} /> Transparent credit estimates</span><span><Check size={14} /> Projects stay connected</span></div><div className="onboarding-actions onboarding-ready-actions"><button className="btn" type="button" onClick={() => finish(routes[profile.workspace])}>Skip tour</button><button className="btn btn-primary" type="button" onClick={startTour}>Show me around <ArrowRight size={16} /></button></div></section></div>;

  return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><section className="onboarding-panel onboarding-personalize"><div className="onboarding-ambient" aria-hidden="true"><span /><span /><span /></div><button className="onboarding-close" type="button" onClick={() => finish()} aria-label="Skip setup"><X size={18} /></button><div className="onboarding-progress" aria-label={`Setup step ${step + 1} of ${questions.length}`}>{questions.map((_, index) => <span key={index} className={index <= step ? "active" : ""} />)}</div><span className="kicker">{current.eyebrow} · {step + 1}/{questions.length}</span><h2 id="onboarding-title">{current.title}</h2><p>{current.body}</p><div className="onboarding-options" role="radiogroup" aria-label={current.title}>{current.options.map((option) => { const Icon = option.icon; const active = selected === option.value; return <button type="button" role="radio" aria-checked={active} className={active ? "selected" : ""} key={option.value} onClick={() => choose(option.value)}><span className="onboarding-option-icon"><Icon size={20} weight={active ? "fill" : "regular"} /></span><span><b>{option.label}</b><small>{option.hint}</small></span><i>{active ? <Check size={14} weight="bold" /> : null}</i></button>; })}</div><div className="onboarding-actions"><button className="btn btn-ghost" type="button" onClick={() => finish()}>Skip setup</button>{step > 0 && <button className="btn" type="button" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} /> Back</button>}<button className="btn btn-primary" type="button" disabled={!selected} onClick={continueSetup}>{step === questions.length - 1 ? "Finish setup" : "Continue"}<ArrowRight size={16} /></button></div></section></div>;
}

