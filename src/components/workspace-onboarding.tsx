"use client";

import Link from "next/link";
import { useEffect,useState } from "react";

const steps=[
 {title:"One creation environment",body:"Chat, Image, Video, and Audio are separate focused workspaces that share your projects, Library, models, and credits."},
 {title:"Keep work connected",body:"Choose a project in the top bar before creating. New chats, uploads, and generations can stay grouped around the same goal."},
 {title:"Costs stay visible",body:"You see an estimate before generation and the actual credit charge afterward. Expensive requests require explicit confirmation."},
 {title:"Work continues safely",body:"Video and other long generations remain in the Generation Center while you move between workspaces."}
];

export function WorkspaceOnboarding(){
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 useEffect(()=>{const timer=window.setTimeout(()=>{if(window.localStorage.getItem("amh-onboarding-v1")!=="complete")setOpen(true)},0);return()=>window.clearTimeout(timer)},[]);
 function finish(){window.localStorage.setItem("amh-onboarding-v1","complete");setOpen(false)}
 if(!open)return null;
 const current=steps[step];
 return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div className="onboarding-panel"><div className="onboarding-progress" aria-label={`Step ${step+1} of ${steps.length}`}>{steps.map((_,index)=><span key={index} className={index<=step?"active":""}/>)}</div><span className="kicker">Welcome to All Model Hub · {step+1}/{steps.length}</span><h2 id="onboarding-title">{current.title}</h2><p>{current.body}</p>{step===0&&<div className="onboarding-workspaces"><span>Chat</span><span>Image</span><span>Video</span><span>Audio</span></div>}<div className="onboarding-actions"><button type="button" className="btn btn-ghost" onClick={finish}>Skip tour</button>{step>0&&<button type="button" className="btn" onClick={()=>setStep(value=>value-1)}>Back</button>}{step<steps.length-1?<button type="button" className="btn btn-primary" onClick={()=>setStep(value=>value+1)}>Continue</button>:<Link className="btn btn-primary" href="/chat" onClick={finish}>Start creating</Link>}</div></div></div>
}

