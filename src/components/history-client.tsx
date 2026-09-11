"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
type Conversation={id:string;title:string;mode:string;preferred_model?:string;pinned:boolean;updated_at:string};
type Job={id:string;modality:string;model_id:string;status:string;prompt?:string;result_urls?:string[];charged_credits?:number;created_at:string};
type FileRow={id:string;name:string;mime_type:string;size_bytes:number;extraction_status:string;created_at:string};
type View="all"|"chat"|"image"|"video"|"audio"|"file";
export function HistoryClient(){
 const [conversations,setConversations]=useState<Conversation[]>([]),[jobs,setJobs]=useState<Job[]>([]),[files,setFiles]=useState<FileRow[]>([]),[q,setQ]=useState(""),[view,setView]=useState<View>("all"),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);const [a,b,c]=await Promise.all([fetch("/api/conversations"),fetch("/api/jobs?limit=100"),fetch("/api/files")]);if(a.ok)setConversations((await a.json()).conversations||[]);if(b.ok)setJobs((await b.json()).jobs||[]);if(c.ok)setFiles((await c.json()).files||[]);setLoading(false)}
 useEffect(()=>{void load()},[]);
 async function patchConversation(id:string,body:Record<string,unknown>){await fetch(`/api/conversations/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});await load()}
 async function removeConversation(id:string){if(!confirm("Delete this conversation permanently?"))return;await fetch(`/api/conversations/${id}`,{method:"DELETE"});await load()}
 const needle=q.trim().toLowerCase();
 const chats=useMemo(()=>conversations.filter(x=>(view==="all"||view==="chat")&&(!needle||`${x.title} ${x.preferred_model||""}`.toLowerCase().includes(needle))),[conversations,view,needle]);
 const media=useMemo(()=>jobs.filter(x=>(view==="all"||view===x.modality)&&(!needle||`${x.prompt||""} ${x.model_id}`.toLowerCase().includes(needle))),[jobs,view,needle]);
 const uploads=useMemo(()=>files.filter(x=>(view==="all"||view==="file")&&(!needle||x.name.toLowerCase().includes(needle))),[files,view,needle]);
 const total=chats.length+media.length+uploads.length;
 return <div className="library-shell"><div className="library-tools"><div className="library-search">⌕<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search chats, prompts, models and files…"/></div><div className="library-filters">{(["all","chat","image","video","audio","file"] as View[]).map(x=><button key={x} className={view===x?"active":""} onClick={()=>setView(x)}>{x}</button>)}</div></div><div className="library-scroll">{loading?<div className="card empty-card">Loading your Library…</div>:total===0?<div className="card empty-card"><h3>Nothing matches this view</h3><p className="muted">Your reusable chats, generations and uploads appear here automatically.</p></div>:<div className="library-grid">
 {chats.map(x=><article className="card library-card" key={`chat-${x.id}`}><div className="library-type">Chat</div><Link href={`/chat?conversation=${x.id}`}><h3>{x.pinned?"★ ":""}{x.title}</h3><p>{x.preferred_model||"Auto Best"} · {new Date(x.updated_at).toLocaleDateString()}</p></Link><div className="library-actions"><button onClick={()=>patchConversation(x.id,{pinned:!x.pinned})}>{x.pinned?"Unpin":"Pin"}</button><button className="danger-text" onClick={()=>removeConversation(x.id)}>Delete</button></div></article>)}
 {media.map(x=>{const url=Array.isArray(x.result_urls)?x.result_urls[0]:undefined,studio=x.modality==="image"?"/images":`/${x.modality}`;return <article className="card library-card" key={`job-${x.id}`}><div className="library-type">{x.modality} · {x.status}</div><h3>{x.prompt?.slice(0,90)||x.model_id}</h3><p>{x.model_id} · {Number(x.charged_credits||0).toFixed(2)} credits</p><div className="library-actions">{url&&<a href={url} target="_blank" rel="noreferrer">Open</a>}<Link href={`${studio}?prompt=${encodeURIComponent(x.prompt||"")}`}>Use again</Link>{url&&<button onClick={()=>navigator.clipboard?.writeText(url)}>Copy link</button>}</div></article>})}
 {uploads.map(x=><article className="card library-card" key={`file-${x.id}`}><div className="library-type">File</div><h3>{x.name}</h3><p>{x.mime_type} · {(x.size_bytes/1024).toFixed(1)} KB · {x.extraction_status}</p><div className="library-actions"><Link href={`/chat?file=${x.id}`}>Use in Chat</Link></div></article>)}
 </div>}</div></div>
}

