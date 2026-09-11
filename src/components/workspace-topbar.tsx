"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type Project = { id: string; name: string };
type Job = { id: string; public_id: string; project_id?: string | null; modality: string; model_id: string; status: string; prompt?: string; result_urls?: string[]; error_message?: string; charged_credits?: number; estimated_credits?: number };
type Model = { id: string; name: string; providerFamily?: string; modality: "text" | "image" | "video" | "audio"; capabilities?: string[] };
type Notification = { id:string; title:string; body:string; read_at?:string|null; created_at:string };

const destinations = [
  { label: "New chat", detail: "Start a conversation", href: "/chat" },
  { label: "Create image", detail: "Open Image Studio", href: "/images" },
  { label: "Create video", detail: "Open Video Studio", href: "/video" },
  { label: "Create audio", detail: "Open Audio Studio", href: "/audio" },
  { label: "Projects", detail: "Organize persistent context", href: "/projects" },
  { label: "Library", detail: "Find chats, files, and generations", href: "/history" },
  { label: "Models", detail: "Compare models and pricing", href: "/models" },
  { label: "Wallet & receipts", detail: "Credits, costs, and usage", href: "/wallet" }
];

export function WorkspaceTopbar({ balance, identity }: { balance: number; identity: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [keyboardHelp,setKeyboardHelp]=useState(false);

  async function loadJobs() {
    const response = await fetch("/api/jobs?limit=20", { cache: "no-store" });
    if (response.ok) setJobs((await response.json()).jobs || []);
  }
  async function loadNotifications(){const response=await fetch("/api/notifications",{cache:"no-store"});if(response.ok)setNotifications((await response.json()).notifications||[])}
  async function markNotificationsRead(id?:string){await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});await loadNotifications()}

  useEffect(() => {
    const saved = window.localStorage.getItem("amh-active-project") || "";
    setProjectId(saved);
    fetch("/api/projects").then((response) => response.json()).then((data) => setProjects(data.projects || [])).catch(() => undefined);
    fetch("/api/models").then((response) => response.json()).then((data) => setModels(data.models || [])).catch(() => undefined);
    void loadJobs();
    void loadNotifications();
    const timer = window.setInterval(() => void loadJobs(), 12000);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if(event.key==="?"&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!(["INPUT","TEXTAREA","SELECT"].includes((event.target as HTMLElement)?.tagName))){event.preventDefault();setKeyboardHelp(true)}
      if (event.key === "Escape") { setPalette(false); setOpen(false); setNotificationsOpen(false); setKeyboardHelp(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", shortcut); };
  }, []);

  const activeCount = jobs.filter((job) => ["queued", "submitted", "processing", "settling"].includes(job.status)).length;
  const unreadCount=notifications.filter(item=>!item.read_at).length;
  const normalizedQuery = query.trim().toLowerCase();
  const matchingDestinations = useMemo(() => destinations.filter((item) => !normalizedQuery || `${item.label} ${item.detail}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery]);
  const matchingProjects = useMemo(() => projects.filter((project) => normalizedQuery && project.name.toLowerCase().includes(normalizedQuery)).slice(0, 4), [normalizedQuery, projects]);
  const matchingModels = useMemo(() => models.filter((model) => normalizedQuery && [model.name, model.providerFamily, model.modality, ...(model.capabilities || [])].join(" ").toLowerCase().includes(normalizedQuery)).slice(0, 6), [models, normalizedQuery]);
  const modelHref = (model: Model) => `${model.modality === "image" ? "/images" : `/${model.modality === "text" ? "chat" : model.modality}`}?model=${encodeURIComponent(model.id)}`;
  function selectProject(next: string) {
    setProjectId(next);
    window.localStorage.setItem("amh-active-project", next);
    window.dispatchEvent(new CustomEvent("amh-project-change", { detail: next }));
  }

  function workspaceHref(job: Job, retry = false) {
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
    <header className="app-topbar">
      <label className="global-project"><span>Project</span><select value={projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Personal workspace</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <button className="command-trigger" type="button" onClick={() => { setQuery(""); setPalette(true); }}><span>⌕</span><span>Search or jump to…</span><kbd>⌘K</kbd></button>
      <div className="topbar-actions">
        <button className="generation-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open generation center"><span className={activeCount ? "status-dot" : "status-dot idle"} />{activeCount ? `${activeCount} working` : "Generations"}</button>
        <button className="topbar-icon-trigger" type="button" onClick={()=>{setNotificationsOpen(true);void loadNotifications()}} aria-label={`Notifications${unreadCount?`, ${unreadCount} unread`:""}`}>◌{unreadCount>0&&<b>{unreadCount>9?"9+":unreadCount}</b>}</button>
        <button className="topbar-icon-trigger keyboard-trigger" type="button" onClick={()=>setKeyboardHelp(true)} aria-label="Keyboard shortcuts">?</button>
        <Link href="/wallet" className="wallet-chip">{balance.toFixed(2)} Credits</Link>
        <span className="topbar-identity">{identity}</span><ThemeToggle />
      </div>
    </header>
    {open && <><button className="workspace-scrim" aria-label="Close generation center" onClick={() => setOpen(false)} /><aside className="generation-drawer" aria-label="Generation center"><div className="drawer-head"><div><div className="kicker">Background work</div><h2>Generation Center</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><div className="drawer-scroll" aria-live="polite">{jobs.length ? jobs.map((job) => {
      const terminalFailure = ["failed", "cancelled", "expired"].includes(job.status);
      const active = ["queued", "submitted", "processing", "settling"].includes(job.status);
      return <article className="generation-row" key={job.id}><span className={`job-state ${job.status}`} /><span className="generation-row-content"><Link href={workspaceHref(job)} onClick={() => setOpen(false)}><b>{job.prompt?.slice(0, 58) || job.model_id}</b><small>{job.modality} · {job.status} · {Number(job.charged_credits || job.estimated_credits || 0).toFixed(2)} credits</small></Link>{job.error_message && terminalFailure && <small className="generation-error">{job.error_message}</small>}<span className="generation-row-actions">{terminalFailure && <button type="button" onClick={() => retryJob(job)}>Retry with settings</button>}<Link href="/usage" onClick={() => setOpen(false)}>Cost details</Link>{active && <small>Cancellation becomes available only when the provider supports it safely.</small>}</span></span></article>;
    }) : <div className="drawer-empty">Your active and recent generations will appear here.</div>}</div><Link className="drawer-footer" href="/usage">Open usage & receipts →</Link></aside></>}
    {notificationsOpen&&<><button className="workspace-scrim" aria-label="Close notifications" onClick={()=>setNotificationsOpen(false)}/><aside className="generation-drawer notification-drawer" aria-label="Notifications"><div className="drawer-head"><div><div className="kicker">Updates</div><h2>Notifications</h2></div><button className="icon-button" onClick={()=>setNotificationsOpen(false)} aria-label="Close">×</button></div><div className="drawer-scroll" aria-live="polite">{notifications.length?notifications.map(item=><button type="button" className={`drawer-notification ${item.read_at?"":"unread"}`} key={item.id} onClick={()=>void markNotificationsRead(item.id)}><span><b>{item.title}</b><small>{item.body}</small></span><time>{new Date(item.created_at).toLocaleString()}</time></button>):<div className="drawer-empty">You’re all caught up.</div>}</div><div className="drawer-footer drawer-footer-actions"><button type="button" disabled={!unreadCount} onClick={()=>void markNotificationsRead()}>Mark all read</button><Link href="/notifications" onClick={()=>setNotificationsOpen(false)}>Open all →</Link></div></aside></>}
    {keyboardHelp&&<div className="command-overlay keyboard-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><button className="workspace-scrim" aria-label="Close keyboard shortcuts" onClick={()=>setKeyboardHelp(false)}/><div className="keyboard-panel"><div className="drawer-head"><div><div className="kicker">Work faster</div><h2>Keyboard shortcuts</h2></div><button className="icon-button" onClick={()=>setKeyboardHelp(false)} aria-label="Close">×</button></div><div className="shortcut-list"><span><b>Search and jump</b><kbd>Ctrl/⌘ K</kbd></span><span><b>Close an open panel</b><kbd>Esc</kbd></span><span><b>Open this help</b><kbd>?</kbd></span><span><b>Send a chat message</b><kbd>Enter</kbd></span><span><b>New line in chat</b><kbd>Shift Enter</kbd></span></div></div></div>}
    {palette && <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette"><button className="workspace-scrim" aria-label="Close command palette" onClick={() => setPalette(false)} /><div className="command-panel"><label className="command-input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations, projects, or models…" /><kbd>Esc</kbd></label><div className="command-list">
      {matchingDestinations.length > 0 && <section><span className="command-section-label">Destinations</span>{matchingDestinations.map((item) => <Link key={item.href} href={item.href} onClick={() => setPalette(false)}><span><b>{item.label}</b><small>{item.detail}</small></span><span>→</span></Link>)}</section>}
      {matchingProjects.length > 0 && <section><span className="command-section-label">Projects</span>{matchingProjects.map((project) => <button key={project.id} type="button" onClick={() => { selectProject(project.id); setPalette(false); }}><span><b>{project.name}</b><small>Switch active project</small></span><span>Activate</span></button>)}</section>}
      {matchingModels.length > 0 && <section><span className="command-section-label">Models</span>{matchingModels.map((model) => <Link key={model.id} href={modelHref(model)} onClick={() => setPalette(false)}><span><b>{model.name}</b><small>{model.providerFamily || "AI"} · {model.modality}</small></span><span>Open</span></Link>)}</section>}
      {!matchingDestinations.length && !matchingProjects.length && !matchingModels.length && <div className="command-empty"><b>No results found</b><span>Try a model, provider, project, or workspace name.</span></div>}
    </div></div></div>}
  </>;
}

