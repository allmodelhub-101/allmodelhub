"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type Project = { id: string; name: string };
type Job = { id: string; public_id: string; modality: string; model_id: string; status: string; prompt?: string; charged_credits?: number; estimated_credits?: number };

export function WorkspaceTopbar({ balance, identity }: { balance: number; identity: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  async function loadJobs() {
    const response = await fetch("/api/jobs?limit=20", { cache: "no-store" });
    if (response.ok) setJobs((await response.json()).jobs || []);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("amh-active-project") || "";
    setProjectId(saved);
    fetch("/api/projects").then((response) => response.json()).then((data) => setProjects(data.projects || [])).catch(() => undefined);
    void loadJobs();
    const timer = window.setInterval(() => void loadJobs(), 12000);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if (event.key === "Escape") { setPalette(false); setOpen(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", shortcut); };
  }, []);

  const activeCount = jobs.filter((job) => ["queued", "submitted", "processing", "settling"].includes(job.status)).length;
  function selectProject(next: string) {
    setProjectId(next);
    window.localStorage.setItem("amh-active-project", next);
    window.dispatchEvent(new CustomEvent("amh-project-change", { detail: next }));
  }

  return <>
    <header className="app-topbar">
      <label className="global-project"><span>Project</span><select value={projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Personal workspace</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <button className="command-trigger" type="button" onClick={() => setPalette(true)}><span>⌕</span><span>Search or jump to…</span><kbd>⌘K</kbd></button>
      <div className="topbar-actions">
        <button className="generation-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open generation center"><span className={activeCount ? "status-dot" : "status-dot idle"} />{activeCount ? `${activeCount} working` : "Generations"}</button>
        <Link href="/wallet" className="wallet-chip">{balance.toFixed(2)} Credits</Link>
        <span className="topbar-identity">{identity}</span><ThemeToggle />
      </div>
    </header>
    {open && <><button className="workspace-scrim" aria-label="Close generation center" onClick={() => setOpen(false)} /><aside className="generation-drawer" aria-label="Generation center"><div className="drawer-head"><div><div className="kicker">Background work</div><h2>Generation Center</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><div className="drawer-scroll">{jobs.length ? jobs.map((job) => <Link href={job.modality === "image" ? "/images" : `/${job.modality}`} className="generation-row" key={job.id} onClick={() => setOpen(false)}><span className={`job-state ${job.status}`} /><span><b>{job.prompt?.slice(0, 58) || job.model_id}</b><small>{job.modality} · {job.status} · {Number(job.charged_credits || job.estimated_credits || 0).toFixed(2)} credits</small></span></Link>) : <div className="drawer-empty">Your active and recent generations will appear here.</div>}</div><Link className="drawer-footer" href="/usage">Open usage & receipts →</Link></aside></>}
    {palette && <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette"><button className="workspace-scrim" aria-label="Close command palette" onClick={() => setPalette(false)} /><div className="command-panel"><div className="command-input">⌕ <input autoFocus placeholder="Search or choose a destination…" /></div><div className="command-list">{[["New chat","/chat"],["Create image","/images"],["Create video","/video"],["Create audio","/audio"],["Projects","/projects"],["Library","/history"],["Models","/models"],["Wallet & receipts","/wallet"]].map(([label,href]) => <Link key={href} href={href} onClick={() => setPalette(false)}>{label}<span>→</span></Link>)}</div></div></div>}
  </>;
}

