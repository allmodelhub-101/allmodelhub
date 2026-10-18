"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ArrowCounterClockwise, Copy, FileText, Trash } from "@phosphor-icons/react";
import styles from "./audio-studio.module.css";

export function SpeechScriptEditor({ value, onChange, limit, busy }: {
  value: string; onChange: (value: string) => void; limit: number; busy: boolean;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;

  function edit(next: string) { onChange(next); setNotice(""); setUndo(null); }
  function clear() {
    if (busy) return;
    setUndo(value); onChange(""); setNotice("Script cleared. Undo is available."); textarea.current?.focus();
  }
  function restore() {
    if (undo == null || busy) return;
    if (undo.length > limit) { setNotice("The previous script exceeds this model’s limit. Choose the original model to restore it."); return; }
    onChange(undo); setUndo(null); setNotice("Script restored."); textarea.current?.focus();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(value); setNotice("Script copied."); }
    catch { textarea.current?.focus(); textarea.current?.select(); setNotice("Copy unavailable. The script is selected so you can copy it manually."); }
  }
  async function importText(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith(".txt")) { setNotice("Choose a plain-text .txt file."); return; }
    if (file.size > 100_000) { setNotice("Choose a text file smaller than 100 KB."); return; }
    setImporting(true);
    try {
      const text = (await file.text()).replace(/^\uFEFF/u, "");
      if (text.length > limit) { setNotice(`This file exceeds the ${limit.toLocaleString()}-character model limit. Your script has not changed.`); return; }
      if (text.includes("\u0000")) { setNotice("This file is not supported plain text. Your script has not changed."); return; }
      setUndo(value); onChange(text); setNotice("Text imported locally. Nothing has been generated or uploaded."); textarea.current?.focus();
    } catch { setNotice("Could not read the file. Your script has not changed."); }
    finally { setImporting(false); }
  }

  return <div className={`${styles.field} ${styles.scriptEditor}`}>
    <div className={styles.scriptHeading}><label htmlFor={id}>Script</label><span id={`${id}-count`}>{value.length.toLocaleString()} / {limit.toLocaleString()}</span></div>
    <div className={styles.scriptSurface}>
      <textarea ref={textarea} id={id} aria-label="Script" aria-describedby={`${id}-count ${id}-help`} value={value} onChange={event => edit(event.target.value)} maxLength={limit} required placeholder="Write or paste your script here…" />
      <div className={styles.scriptToolbar}>
        <span>{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
        <div>
          <input ref={fileInput} type="file" accept=".txt,text/plain" aria-label="Import script text file" hidden onChange={importText} />
          <button type="button" disabled={busy || importing} onClick={() => fileInput.current?.click()}><FileText aria-hidden="true" />{importing ? "Reading…" : "Import .txt"}</button>
          <button type="button" disabled={!value} onClick={() => void copy()}><Copy aria-hidden="true" />Copy</button>
          {undo != null && <button type="button" disabled={busy || importing} onClick={restore}><ArrowCounterClockwise aria-hidden="true" />Undo</button>}
          <button type="button" disabled={!value || busy || importing} onClick={clear}><Trash aria-hidden="true" />Clear</button>
        </div>
      </div>
    </div>
    <small id={`${id}-help`} className={styles.scriptHelp}>Paste text or import a .txt file. Only Generate Speech starts a paid request.</small>
    {notice && <small className={styles.scriptNotice} role="status">{notice}</small>}
  </div>;
}
