"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { ArrowSquareOut, CheckCircle, CloudArrowUp, File, FileDoc, FileImage, FilePdf, MagnifyingGlass, ShieldCheck, Trash, X } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";

type Project = { id: string; name: string };
type FileItem = { id: string; project_id?: string | null; name: string; mime_type?: string; size_bytes: number; extraction_status: string; created_at?: string };
type Quota = { tier: "free" | "creator" | "studio"; label: string; usedBytes: number; limitBytes: number; remainingBytes: number; maxFileBytes: number; percent: number; lifetimePurchasedCredits: number };

const EMPTY_QUOTA: Quota = { tier: "free", label: "Free storage", usedBytes: 0, limitBytes: 25 * 1024 * 1024, remainingBytes: 25 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024, percent: 0, lifetimePurchasedCredits: 0 };

function formatBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(value >= 10 * 1024 ** 2 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function FileGlyph({ name }: { name: string }) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return <FilePdf weight="duotone" />;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension || "")) return <FileImage weight="duotone" />;
  if (["doc", "docx", "txt", "md"].includes(extension || "")) return <FileDoc weight="duotone" />;
  return <File weight="duotone" />;
}

export function FilesClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quota, setQuota] = useState<Quota>(EMPTY_QUOTA);
  const [selected, setSelected] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function load() {
    const [filesResponse, projectsResponse] = await Promise.all([fetch("/api/files"), fetch("/api/projects")]);
    if (filesResponse.ok) {
      const payload = await filesResponse.json();
      setFiles(payload.files || []);
      setQuota(payload.quota || EMPTY_QUOTA);
    }
    if (projectsResponse.ok) setProjects((await projectsResponse.json()).projects || []);
  }

  useEffect(() => { void load(); }, []);

  function choose(next: File | null) {
    if (!next) return;
    if (next.size > quota.maxFileBytes) {
      setSelected(null);
      setStatus(`This plan allows up to ${formatBytes(quota.maxFileBytes)} per file.`);
      return;
    }
    setStatus("");
    setSelected(next);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) { choose(event.target.files?.[0] || null); }
  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0] || null);
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = new FormData(); form.append("file", selected); if (projectId) form.append("projectId", projectId);
    setBusy(true); setStatus("Securing upload and preparing AI context…");
    const response = await fetch("/api/files", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Upload complete — your file is ready." : payload.error || "Upload failed.");
    if (response.ok) { setSelected(null); if (inputRef.current) inputRef.current.value = ""; await load(); }
    setBusy(false);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/files/${id}`, { method: "DELETE" });
    setStatus(response.ok ? "File deleted and storage released." : "Could not delete the file.");
    if (response.ok) await load();
  }

  const visibleFiles = files.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="files-console">
    <section className="files-quota-card" aria-label="Storage usage">
      <div className="files-quota-copy">
        <span className={`files-tier files-tier-${quota.tier}`}><ShieldCheck weight="fill" />{quota.label}</span>
        <strong>{formatBytes(quota.usedBytes)} <small>of {formatBytes(quota.limitBytes)} used</small></strong>
        <p>{formatBytes(quota.remainingBytes)} available · {formatBytes(quota.maxFileBytes)} maximum per file</p>
      </div>
      <div className="files-meter-wrap">
        <span><b>{Math.round(quota.percent)}%</b> used</span>
        <div className="files-meter" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(quota.percent)}><i style={{ width: `${quota.percent}%` }} /></div>
        {quota.tier !== "studio" && <a href="/wallet">Increase storage <ArrowSquareOut weight="bold" /></a>}
      </div>
    </section>

    <div className="files-grid">
      <section className="files-upload-panel">
        <div className="files-section-head"><div><span>01 · Upload</span><h2>Add knowledge</h2><p>Private, encrypted source material for your AI workspace.</p></div><CloudArrowUp weight="duotone" /></div>
        <form onSubmit={upload} className="files-upload-form">
          <input ref={inputRef} className="files-native-input" type="file" onChange={onFileChange} />
          <button type="button" className={`files-dropzone ${dragging ? "is-dragging" : ""} ${selected ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <span className="files-drop-icon">{selected ? <CheckCircle weight="fill" /> : <CloudArrowUp weight="duotone" />}</span>
            <span><strong>{selected ? selected.name : "Drop a file here"}</strong><small>{selected ? `${formatBytes(selected.size)} · Ready to upload` : "or click to browse your device"}</small></span>
            {selected && <span className="files-clear" role="button" aria-label="Clear selected file" onClick={(event) => { event.stopPropagation(); setSelected(null); if (inputRef.current) inputRef.current.value = ""; }}><X weight="bold" /></span>}
          </button>
          <div className="files-supported">PDF, DOCX, TXT, Markdown, CSV, spreadsheets, code and images <span>Up to {formatBytes(quota.maxFileBytes)}</span></div>
          <label className="label">Save to workspace<PremiumSelect value={projectId} onChange={setProjectId} options={[{ value: "", label: "General library" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} /></label>
          <button className="btn btn-primary files-upload-button" disabled={!selected || busy}>{busy ? <><span className="files-spinner" />Preparing file…</> : <><CloudArrowUp weight="bold" />Upload to library</>}</button>
          {status && <div className="files-status" role="status">{status}</div>}
        </form>
      </section>

      <section className="files-library-panel">
        <div className="files-library-head"><div><span>02 · Library</span><h2>Your private files</h2></div><b>{files.length}</b></div>
        <label className="files-search"><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a file…" aria-label="Search files" /></label>
        <div className="files-list">
          {visibleFiles.length ? visibleFiles.map((item) => <article className="files-row" key={item.id}>
            <span className="files-type"><FileGlyph name={item.name} /></span>
            <span className="files-name"><strong title={item.name}>{item.name}</strong><small>{formatBytes(Number(item.size_bytes))} · {item.extraction_status === "ready" ? "AI context ready" : item.extraction_status === "unsupported" ? "Stored securely" : item.extraction_status}</small></span>
            <span className={`files-state ${item.extraction_status === "ready" ? "is-ready" : ""}`}>{item.extraction_status === "ready" ? "Ready" : "Stored"}</span>
            <button className="files-delete" onClick={() => remove(item.id, item.name)} aria-label={`Delete ${item.name}`} title="Delete file"><Trash weight="bold" /></button>
          </article>) : <div className="files-empty"><File weight="duotone" /><strong>{query ? "No matching files" : "Your library is ready"}</strong><p>{query ? "Try another search." : "Upload your first file to give AI trusted context."}</p></div>}
        </div>
      </section>
    </div>
  </div>;
}


