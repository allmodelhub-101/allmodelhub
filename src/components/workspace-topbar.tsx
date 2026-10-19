"use client";

import { Bell, CaretDown, CaretRight, Check, Command, FolderSimple, MagnifyingGlass, GearSix, SignOut, Wallet, X } from "@phosphor-icons/react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCompactWorkspaceHeader, useWorkspaceHydrated, workspaceGenerationStatus, openWorkspaceNavigationPanel, workspaceNavigationShortcut, type WorkspaceNavigationPanel } from "./workspace-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceOverlay } from "./use-workspace-overlay";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGenerationCenter } from "./use-generation-center";
import { generationChargeLabel, isActiveGeneration, type GenerationCenterJob as Job } from "@/lib/generation-center";
import "./generation-center.css";

type Project = { id: string; name: string };
type Model = { id: string; name: string; providerFamily?: string; modality: "text" | "image" | "video" | "audio"; capabilities?: string[] };
type Notification = { id:string; title:string; body:string; read_at?:string|null; created_at:string };
type SearchResult={id:string;kind:"chat"|"generation"|"file";label:string;detail:string;href:string};

const destinations = [
  { label: "New chat", detail: "Start a conversation", href: "/chat" },
  { label: "Create image", detail: "Open Image Studio", href: "/images" },
  { label: "Create video", detail: "Open Video Studio", href: "/video" },
  { label: "Create audio", detail: "Open Audio Studio", href: "/audio" },
  { label: "Projects", detail: "Organize persistent context", href: "/projects" },
  { label: "Library", detail: "Find chats, files, and generations", href: "/history" },
  { label: "Models", detail: "Compare models and pricing", href: "/models" },
  { label: "Compare models", detail: "Run one prompt across multiple models", href: "/battle" },
  { label: "Files", detail: "Manage private knowledge", href: "/files" },
  { label: "Templates", detail: "Reuse proven prompt workflows", href: "/templates" },
  { label: "Wallet", detail: "Credits and billing", href: "/wallet" },
  { label: "Usage & receipts", detail: "Review costs and receipts", href: "/usage" },
  { label: "Notifications", detail: "See workspace updates", href: "/notifications" },
  { label: "Settings", detail: "Preferences and account controls", href: "/settings" },
  { label: "Help", detail: "Guidance and support", href: "/support" }
];

export function WorkspaceTopbar({ balance, identity, language = "en", offline = false, fixtureData }: { balance: number; identity: string; language?: string; offline?: boolean; fixtureData?: { projects: Project[]; notifications: Notification[]; jobs: Job[] } }) {
  const [liveBalance, setLiveBalance] = useState(balance);
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>(offline ? fixtureData?.projects || [] : []);
  const [models, setModels] = useState<Model[]>([]);
  const [projectId, setProjectId] = useState("");
  const [open, setOpen] = useState(false);
  const { jobs: liveJobs, refreshing: jobsRefreshing, refreshError: jobsRefreshError, checkedAt: jobsCheckedAt, refresh: loadJobs } = useGenerationCenter(open, offline);
  const jobs = offline && fixtureData ? fixtureData.jobs : liveJobs;
  const compactHeader = useCompactWorkspaceHeader();
  const hydrated = useWorkspaceHydrated();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  useWorkspaceOverlay(accountOpen, accountRef, () => setAccountOpen(false));
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const closeOnWide = () => { if (!media.matches) setAccountOpen(false); };
    media.addEventListener("change", closeOnWide);
    return () => media.removeEventListener("change", closeOnWide);
  }, []);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications,setNotifications]=useState<Notification[]>(offline ? fixtureData?.notifications || [] : []);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [keyboardHelp,setKeyboardHelp]=useState(false);
  const [projectOpen,setProjectOpen]=useState(false);
  const [productResults,setProductResults]=useState<SearchResult[]>([]);
  const [searching,setSearching]=useState(false);
  const generationRef = useRef<HTMLElement | null>(null);
  const notificationsRef = useRef<HTMLElement | null>(null);
  const helpRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const openPanel = (event: Event) => {
      const panel = (event as CustomEvent<WorkspaceNavigationPanel>).detail;
      setAccountOpen(false);
      if (panel === "generations") setOpen(true);
      if (panel === "command") { setQuery(""); setPalette(true); }
      if (panel === "help") setKeyboardHelp(true);
    };
    window.addEventListener("amh-open-navigation-panel", openPanel);
    return () => window.removeEventListener("amh-open-navigation-panel", openPanel);
  }, []);
  useWorkspaceOverlay(open, generationRef, () => setOpen(false));
  useWorkspaceOverlay(notificationsOpen, notificationsRef, () => setNotificationsOpen(false));
  useWorkspaceOverlay(keyboardHelp, helpRef, () => setKeyboardHelp(false));
  useWorkspaceOverlay(palette, paletteRef, () => setPalette(false));
  useWorkspaceOverlay(projectOpen, projectRef, () => setProjectOpen(false), false);


  const loadNotifications = useCallback(async () => {if(offline)return;const response=await fetch("/api/notifications",{cache:"no-store"});if(response.ok)setNotifications((await response.json()).notifications||[])}, [offline]);
  const refreshWallet = useCallback(async () => {
    if (offline) return;
    setWalletRefreshing(true);
    try { const response=await fetch("/api/wallet",{cache:"no-store"});if(response.ok){const data=await response.json();if(Number.isFinite(Number(data.wallet?.available)))setLiveBalance(Number(data.wallet.available));} }
    finally { setWalletRefreshing(false); }
  }, [offline]);
  async function markNotificationsRead(id?:string){if(offline)return;await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});await loadNotifications()}

  useEffect(() => {
    const saved = window.localStorage.getItem("amh-active-project") || "";
    window.setTimeout(()=>setProjectId(saved),0);
    if (!offline) fetch("/api/projects").then((response) => response.json()).then((data) => setProjects(data.projects || [])).catch(() => undefined);
    if (!offline) fetch("/api/models", { cache: "no-store" }).then((response) => response.json()).then((data) => setModels(data.models || [])).catch(() => undefined);
    const initialLoad=window.setTimeout(()=>{void loadNotifications();void refreshWallet()},0);
    const walletTimer = window.setInterval(() => void refreshWallet(), 30000);
    const shortcut = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if(event.key==="?"&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!(["INPUT","TEXTAREA","SELECT"].includes((event.target as HTMLElement)?.tagName))){event.preventDefault();setKeyboardHelp(true)}

    };
    window.addEventListener("keydown", shortcut);
    const walletRefresh = () => void refreshWallet();
    window.addEventListener("amh-wallet-refresh", walletRefresh);
    return () => { window.clearTimeout(initialLoad);window.clearInterval(walletTimer); window.removeEventListener("keydown", shortcut); window.removeEventListener("amh-wallet-refresh", walletRefresh); };
  }, [offline, loadNotifications, refreshWallet]);

  const activeCount = jobs.filter(isActiveGeneration).length;
  useEffect(() => {
    workspaceGenerationStatus.publish(activeCount);
    return () => workspaceGenerationStatus.publish(0);
  }, [activeCount]);
  const activeProjectName=projects.find(project=>project.id===projectId)?.name||"Personal";
  const unreadCount=notifications.filter(item=>!item.read_at).length;
  const normalizedQuery = query.trim().toLowerCase();
  const matchingDestinations = useMemo(() => destinations.filter((item) => !normalizedQuery || `${item.label} ${item.detail}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery]);
  const matchingProjects = useMemo(() => projects.filter((project) => normalizedQuery && project.name.toLowerCase().includes(normalizedQuery)).slice(0, 4), [normalizedQuery, projects]);
  const matchingModels = useMemo(() => models.filter((model) => normalizedQuery && [model.name, model.providerFamily, model.modality, ...(model.capabilities || [])].join(" ").toLowerCase().includes(normalizedQuery)).slice(0, 6), [models, normalizedQuery]);
  useEffect(()=>{const controller=new AbortController();const timer=window.setTimeout(()=>{if(offline||!palette||normalizedQuery.length<2){setProductResults([]);setSearching(false);return}setSearching(true);fetch(`/api/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal}).then(response=>response.ok?response.json():{results:[]}).then(data=>setProductResults(data.results||[])).catch(()=>undefined).finally(()=>setSearching(false))},palette&&normalizedQuery.length>=2?220:0);return()=>{window.clearTimeout(timer);controller.abort()}},[normalizedQuery,palette,query,offline]);
  const modelHref = (model: Model) => `${model.modality === "image" ? "/images" : `/${model.modality === "text" ? "chat" : model.modality}`}?model=${encodeURIComponent(model.id)}`;
  function selectProject(next: string) {
    setProjectId(next);
    window.localStorage.setItem("amh-active-project", next);
    if (!offline) window.dispatchEvent(new CustomEvent("amh-project-change", { detail: next }));
  }

  function workspaceHref(job: Job, retry = false) {
    if (job.modality === "text") return job.conversation_id ? `/chat?conversation=${encodeURIComponent(job.conversation_id)}` : "/chat";
    const path = job.modality === "image" ? "/images" : `/${job.modality}`;
    if (!retry) return path;
    const params = new URLSearchParams({ model: job.model_id, prompt: job.prompt || "" });
    return `${path}?${params.toString()}`;
  }

  function retryJob(job: Job) {
    if (job.project_id) selectProject(job.project_id);
    window.location.assign(workspaceHref(job, true));
  }

  return <>
    <header className="app-topbar workspace-topbar" data-workspace-ready={hydrated ? "true" : "false"}>
      <div className="global-project-wrap"><button className="global-project" aria-label={`Active project: ${activeProjectName}`} title={activeProjectName} type="button" onClick={(event)=>{event.currentTarget.focus();setProjectOpen(value=>!value)}} aria-haspopup="dialog" aria-expanded={projectOpen}><FolderSimple size={15} aria-hidden="true"/><span>{activeProjectName}</span><CaretDown size={13} aria-hidden="true"/></button>{projectOpen&&<><button className="project-popover-scrim" type="button" aria-label="Close project menu" onClick={()=>setProjectOpen(false)}/><div ref={projectRef} className="project-popover" role="dialog" tabIndex={-1} aria-label="Select project"><span className="project-popover-label">Active project</span><button type="button" className={!projectId?"active":""} onClick={()=>{selectProject("");setProjectOpen(false)}}><span><b>Personal workspace</b><small>Default private workspace</small></span>{!projectId&&<Check size={15}/>}</button>{projects.map(project=><button type="button" aria-pressed={projectId===project.id} className={projectId===project.id?"active":""} key={project.id} onClick={()=>{selectProject(project.id);setProjectOpen(false)}}><span><b>{project.name}</b><small>Persistent project context</small></span>{projectId===project.id&&<Check size={15}/>}</button>)}<Link href="/projects" onClick={()=>setProjectOpen(false)}>Manage projects <CaretRight size={13}/></Link></div></>}</div>
      <button className="command-trigger" aria-label="Search or jump to workspace" type="button" onClick={(event) => { event.currentTarget.focus(); setQuery(""); setPalette(true); }}><MagnifyingGlass size={17} aria-hidden="true" /><span>{language==="ur"?"تلاش کریں یا جائیں…":language==="roman-ur"?"Talash karein ya jayein…":"Search or jump to…"}</span><kbd><Command size={11} aria-hidden="true" />K</kbd></button>
      <div className="topbar-actions">
        <button className="generation-trigger" type="button" onClick={(event) => { event.currentTarget.focus(); setOpen(true); }} aria-label="Open generation center"><span className={activeCount ? "status-dot" : "status-dot idle"} />{activeCount ? `${activeCount} ${language==="ur"?"جاری":language==="roman-ur"?"jaari":"working"}` : language==="ur"?"تخلیقات":language==="roman-ur"?"Generations":"Generations"}</button>
        <button className="topbar-icon-trigger" type="button" onClick={(event)=>{event.currentTarget.focus();setNotificationsOpen(true);void loadNotifications()}} aria-label={`Notifications${unreadCount?`, ${unreadCount} unread`:""}`}><Bell size={17} aria-hidden="true" />{unreadCount>0&&<b>{unreadCount>9?"9+":unreadCount}</b>}</button>
        <Link href="/wallet" className={`wallet-chip wallet-chip-live ${walletRefreshing ? "is-refreshing" : ""}`} aria-label={`${liveBalance.toFixed(2)} credits available. Balance refreshes automatically.`}><span className="wallet-live-signal" aria-hidden="true" /><Wallet size={14} aria-hidden="true" /><span>{liveBalance.toFixed(2)} Credits</span><small>Live</small></Link>
        {!compactHeader && <ThemeToggle />}
        <Link href="/settings" className="topbar-profile desktop-account-link" aria-label="Open account settings"><span>{identity.slice(0, 1).toUpperCase()}</span><CaretDown size={12} weight="bold" aria-hidden="true" /></Link>
        <button className="mobile-profile-trigger topbar-profile" type="button" aria-label="Open mobile account menu" aria-haspopup="dialog" aria-expanded={accountOpen} onClick={event => { event.currentTarget.focus(); setAccountOpen(true); }}><span>{identity.slice(0, 1).toUpperCase()}</span></button>
      </div>
    </header>
    {accountOpen && compactHeader && createPortal(<div className="workspace-mobile-account-layer"><button className="workspace-mobile-account-backdrop" type="button" aria-label="Close account menu" onClick={() => setAccountOpen(false)} /><div ref={accountRef} onKeyDown={event => { const panel = workspaceNavigationShortcut(event); if (!panel) return; event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); openWorkspaceNavigationPanel(panel); }} className="workspace-mobile-account-panel" role="dialog" aria-modal="true" aria-label="Account" tabIndex={-1}><div className="workspace-mobile-account-heading"><strong>Account</strong><button type="button" aria-label="Close account menu" onClick={() => setAccountOpen(false)}><X size={18} aria-hidden="true" /></button></div><Link href="/settings" prefetch={false} onClick={() => setAccountOpen(false)}><GearSix size={19} aria-hidden="true" />Account & settings</Link><div className="workspace-mobile-account-theme"><span>Appearance</span><ThemeToggle /></div><form action="/auth/logout" method="post"><button type="submit"><SignOut size={19} aria-hidden="true" />Sign out</button></form></div></div>, document.body)}
    {open && <><button className="workspace-scrim" aria-label="Close generation center" onClick={() => setOpen(false)} /><aside ref={generationRef} role="dialog" aria-modal="true" tabIndex={-1} className="generation-drawer" aria-label="Generation center"><div className="drawer-head"><div><div className="kicker">Background work</div><h2>Generation Center</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="drawer-scroll">
      <div className="generation-refresh"><span role="status">{offline ? "Offline · showing last loaded status" : jobsRefreshing ? "Refreshing statuses…" : jobsCheckedAt ? `Updated ${jobsCheckedAt.toLocaleTimeString()}` : "Waiting for first update"}</span><button type="button" disabled={offline || jobsRefreshing} onClick={() => void loadJobs()}>Refresh</button></div>
      {jobsRefreshError && <p className="generation-refresh-error" role="alert">{jobsRefreshError}</p>}
      {!activeCount && jobsCheckedAt && !jobsRefreshError && <p className="generation-idle">No generations currently in progress.</p>}
      {jobs.length ? [{ label: "In progress", items: jobs.filter(isActiveGeneration) }, { label: "Recent history", items: jobs.filter(job => !isActiveGeneration(job)) }].filter(group => group.items.length).map(group => <section className="generation-group" key={group.label} aria-label={group.label}><h3>{group.label}</h3>{group.label === "Recent history" && <p>Past results, not current model availability. Full history is in Library.</p>}{group.items.map((job) => {
      const terminalFailure = ["failed", "cancelled", "expired"].includes(job.status);
      const active = ["queued", "submitted", "processing", "settling"].includes(job.status);
      const timestamp = active ? job.updated_at || job.created_at : job.completed_at || job.updated_at || job.created_at;
      return <article className="generation-row" key={job.id}><span className={`job-state ${job.status}`} /><span className="generation-row-content"><Link href={workspaceHref(job)} onClick={() => setOpen(false)}><b>{job.prompt?.slice(0, 58) || job.model_id}</b><small>{job.modality === "text" ? "chat" : job.modality} · {job.status} · {generationChargeLabel(job)}</small></Link><small>{job.model_id}{job.source === "chat-session" && " · Current chat session"}{timestamp && <time dateTime={timestamp}> · {new Date(timestamp).toLocaleString()}</time>}</small>{job.error_message && terminalFailure && <small className="generation-error">Recorded failure: {job.error_message}</small>}<span className="generation-row-actions">{terminalFailure && job.source !== "chat-session" && <button type="button" onClick={() => retryJob(job)}>Retry with settings</button>}<Link href="/usage" onClick={() => setOpen(false)}>Cost details</Link>{active && job.source !== "chat-session" && <small>Cancellation becomes available only when the provider supports it safely.</small>}</span></span></article>;
    })}</section>) : <div className="drawer-empty">{jobsRefreshing ? "Loading generations…" : jobsRefreshError ? "Generations are temporarily unavailable. Please refresh." : "Your active and recent generations will appear here."}</div>}</div><Link className="drawer-footer" href="/usage">Open usage & receipts <CaretRight size={14} /></Link></aside></>}
    {notificationsOpen&&<><button className="workspace-scrim" aria-label="Close notifications" onClick={()=>setNotificationsOpen(false)}/><aside ref={notificationsRef} role="dialog" aria-modal="true" tabIndex={-1} className="generation-drawer notification-drawer" aria-label="Notifications"><div className="drawer-head"><div><div className="kicker">Updates</div><h2>Notifications</h2></div><button className="icon-button" onClick={()=>setNotificationsOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="drawer-scroll" aria-live="polite">{notifications.length?notifications.map(item=><button type="button" className={`drawer-notification ${item.read_at?"":"unread"}`} key={item.id} onClick={()=>void markNotificationsRead(item.id)}><span><b>{item.title}</b><small>{item.body}</small></span><time>{new Date(item.created_at).toLocaleString()}</time></button>):<div className="drawer-empty">You’re all caught up.</div>}</div><div className="drawer-footer drawer-footer-actions"><button type="button" disabled={!unreadCount} onClick={()=>void markNotificationsRead()}>Mark all read</button><Link href="/notifications" onClick={()=>setNotificationsOpen(false)}>Open all <CaretRight size={14} /></Link></div></aside></>}
    {keyboardHelp&&<div ref={helpRef} tabIndex={-1} className="command-overlay keyboard-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><button className="workspace-scrim" aria-label="Close keyboard shortcuts" onClick={()=>setKeyboardHelp(false)}/><div className="keyboard-panel"><div className="drawer-head"><div><div className="kicker">Work faster</div><h2>Keyboard shortcuts</h2></div><button className="icon-button" onClick={()=>setKeyboardHelp(false)} aria-label="Close"><X size={18} /></button></div><div className="shortcut-list"><span><b>Search and jump</b><kbd>Ctrl/⌘ K</kbd></span><span><b>Close an open panel</b><kbd>Esc</kbd></span><span><b>Open this help</b><kbd>?</kbd></span><span><b>Send a chat message</b><kbd>Enter</kbd></span><span><b>New line in chat</b><kbd>Shift Enter</kbd></span></div></div></div>}
    {palette && <div ref={paletteRef} tabIndex={-1} className="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette"><button className="workspace-scrim" aria-label="Close command palette" onClick={() => setPalette(false)} /><div className="command-panel"><label className="command-input"><MagnifyingGlass size={19} aria-hidden="true" /><input aria-label="Search workspace" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats, generations, files, projects, or models…" /><kbd>Esc</kbd></label><div className="command-list">
      {matchingDestinations.length > 0 && <section><span className="command-section-label">Destinations</span>{matchingDestinations.map((item) => <Link key={item.href} href={item.href} onClick={() => setPalette(false)}><span><b>{item.label}</b><small>{item.detail}</small></span><span>→</span></Link>)}</section>}
      {matchingProjects.length > 0 && <section><span className="command-section-label">Projects</span>{matchingProjects.map((project) => <button key={project.id} type="button" onClick={() => { selectProject(project.id); setPalette(false); }}><span><b>{project.name}</b><small>Switch active project</small></span><span>Activate</span></button>)}</section>}
      {matchingModels.length > 0 && <section><span className="command-section-label">Models</span>{matchingModels.map((model) => <Link key={model.id} href={modelHref(model)} onClick={() => setPalette(false)}><span><b>{model.name}</b><small>{model.providerFamily || "AI"} · {model.modality}</small></span><span>Open</span></Link>)}</section>}
      {productResults.length>0&&<section><span className="command-section-label">Your content</span>{productResults.map(item=><Link key={`${item.kind}-${item.id}`} href={item.href} onClick={()=>setPalette(false)}><span><b>{item.label}</b><small>{item.kind} · {item.detail}</small></span><span>Open</span></Link>)}</section>}
      {searching&&<div className="command-empty"><span>Searching your workspace…</span></div>}
      {!searching&&!matchingDestinations.length&&!matchingProjects.length&&!matchingModels.length&&!productResults.length&&<div className="command-empty"><b>No results found</b><span>Try a chat title, prompt, filename, model, provider, project, or workspace.</span></div>}
    </div></div></div>}
  </>;
}

