"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Conversation = { id:string; title:string; mode:string; preferred_model?:string; pinned:boolean; updated_at:string };
export function HistoryClient() {
  const [rows,setRows]=useState<Conversation[]>([]), [q,setQ]=useState("");
  async function load(search=q){const r=await fetch(`/api/conversations${search?`?q=${encodeURIComponent(search)}`:""}`);if(r.ok)setRows((await r.json()).conversations||[])}
  useEffect(()=>{const timer = window.setTimeout(() => { void fetch("/api/conversations").then((r)=>r.ok?r.json():null).then((data)=>{if(data) setRows(data.conversations || []);}); }, 0); return () => window.clearTimeout(timer);},[]);
  async function patch(id:string, body:Record<string,unknown>){await fetch(`/api/conversations/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});await load()}
  async function remove(id:string){if(!confirm("Delete this conversation permanently?"))return;await fetch(`/api/conversations/${id}`,{method:"DELETE"});await load()}
  return <div><form className="history-search" onSubmit={(e)=>{e.preventDefault();void load()}}><input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search conversation titles…"/><button className="btn">Search</button></form><div className="list-grid">{rows.length?rows.map(c=><div className="card list-card" key={c.id}><Link href={`/chat?conversation=${c.id}`} className="history-main"><b>{c.pinned?"★ ":""}{c.title}</b><div className="muted small">{c.mode} · {c.preferred_model||"Auto Best"} · {new Date(c.updated_at).toLocaleString()}</div></Link><div className="history-actions"><button className="icon-button" onClick={()=>patch(c.id,{pinned:!c.pinned})}>{c.pinned?"Unpin":"Pin"}</button><button className="icon-button danger-text" onClick={()=>remove(c.id)}>Delete</button></div></div>):<div className="card empty-card">No matching conversations.</div>}</div></div>;
}
