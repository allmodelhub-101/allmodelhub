"use client";
import { chatComposerKeyAction, chatPromptWithContext, pastedChatContext } from "@/lib/chat-composer-events";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceFrame } from "./workspace-frame";
import { WorkspaceTopbar } from "./workspace-topbar";
import { AppSidebar } from "./app-sidebar";
import { ChatWorkspace, type ChatMessage, type Model, type Mode, type UserFile } from "./chat-workspace";

const models:Model[] = [
 {id:"sample-reasoning",name:"Sample reasoning",providerFamily:"Fixture",tier:"balanced",modality:"text",capabilities:["reasoning","coding"],available:true,retail:{inputPerMillionCredits:2,outputPerMillionCredits:4}},
 {id:"sample-fast",name:"Sample fast",providerFamily:"Fixture",tier:"budget",modality:"text",capabilities:["fast"],available:true},
 {id:"sample-unavailable",name:"Sample unavailable",tier:"premium",modality:"text",autoEligible:true,available:false}
];
const projects=[{id:"sample-project",name:"Sample research project with a descriptive title"}];
const fixtureFiles:UserFile[]=Array.from({length:3},(_,i)=>({id:`file-${i}`,name:`Research_notes_${i}_`+"long_filename_".repeat(10)+".pdf",size_bytes:204800,extraction_status:"ready"}));
const markdown = `# A practical research plan

This synthetic answer demonstrates the real Markdown renderer.

## Steps

1. Define the question.
2. Compare the evidence.
   - Keep assumptions visible.
   - Explain uncertainty.

> A quoted note with **emphasis** and a [long reference](https://example.invalid/${"reference".repeat(35)}).

${"unbroken_reference_".repeat(35)}

\`\`\`typescript
const reference = "${"long_code_token".repeat(45)}";
console.log(reference);
\`\`\`

| ${Array.from({length:9},(_,i)=>`Research column ${i}`).join(" | ")} |
| ${Array(9).fill("---").join(" | ")} |
${Array.from({length:5},(_,i)=>"| "+Array.from({length:9},(_,j)=>`Detailed sample ${i}-${j}`).join(" | ")+" |").join("\n")}

${Array.from({length:12},(_,i)=>`### Finding ${i+1}\n\n${"A substantial answer paragraph. ".repeat(5)}`).join("\n\n")}`;
function initialMessages(state:string):ChatMessage[]{
 if(state==="welcome")return [];
 if(state==="stress")return Array.from({length:80},(_,i)=>[{id:`stress-user-${i}`,role:"user" as const,content:`Research question ${i+1}`},{id:`stress-answer-${i}`,role:"assistant" as const,content:i%8===0?markdown:"A concise synthetic answer with **clear next steps**.",meta:"Sample model · 0.1250 credits"}]).flat();
 if(state==="long"||state==="streaming")return Array.from({length:10},(_,i)=>[{id:`user-${i}`,role:"user" as const,content:`Research question ${i+1}`},{id:`answer-${i}`,role:"assistant" as const,content:i===9?markdown:"A clear, concise sample response.",meta:"Sample model · 0.1250 credits"}]).flat();
 return [{id:"user",role:"user",content:"Help me understand this research."},{id:state==="loading"?"pending-sample":"answer",role:"assistant",content:state==="loading"||state==="error"?"":state==="interrupted"?"This response ended before it was complete.":"A helpful answer with **clear next steps**.",interrupted:state==="interrupted"||state==="error",meta:state==="pending"?"Sample model · Billing pending":state==="interrupted"?"Response interrupted · Retry available":undefined}];
}
export function ChatFixture({state="welcome"}:{state?:string}){
 const [messages,setMessages]=useState(()=>initialMessages(state));
 const [input,setInput]=useState(state==="error"?"My preserved draft":"");
 const [busy,setBusy]=useState(state==="loading"||state==="streaming");
 const [mode,setMode]=useState<Mode>("auto"),[modelId,setModelId]=useState(""),[projectId,setProjectId]=useState(state==="project"?projects[0].id:"");
 const [pickerOpen,setPickerOpen]=useState(false),[dragActive,setDragActive]=useState(false),[pastedContext,setPastedContext]=useState("");
 const [files,setFiles]=useState(fixtureFiles),[attachmentIds,setAttachmentIds]=useState(state==="attachments"?fixtureFiles.map(f=>f.id):[]);
 const [deepThink,setDeepThink]=useState(false),[privateMode,setPrivateMode]=useState(false),[voiceActive,setVoiceActive]=useState(false);
 const [conversationId,setConversationId]=useState("fixture"),[error,setError]=useState(state==="error"?"Synthetic connection failure. Retry when ready.":""),[copiedKey,setCopiedKey]=useState("");
 const textareaRef=useRef<HTMLTextAreaElement|null>(null),fileInputRef=useRef<HTMLInputElement|null>(null);
 const exact=useMemo(()=>models.find(m=>m.id===modelId),[modelId]);
 useEffect(()=>{if(state!=="streaming"||!busy)return;const timer=setInterval(()=>setMessages(current=>current.map((m,i)=>i===current.length-1?{...m,content:m.content+" New local token."}:m)),250);return()=>clearInterval(timer)},[state,busy]);
 const focusComposer=(prompt?:string)=>{if(prompt)setInput(prompt);textareaRef.current?.focus()};
 const stopGeneration=()=>{setBusy(false);setMessages(current=>current.map((m,i)=>i===current.length-1?{...m,interrupted:true,meta:"Response interrupted · Retry available"}:m))};
 const submit=(event?:React.FormEvent)=>{event?.preventDefault();if(busy||(!input.trim()&&!pastedContext))return;setMessages(current=>[...current,{id:crypto.randomUUID(),role:"user",content:chatPromptWithContext(input,pastedContext)},{id:crypto.randomUUID(),role:"assistant",content:"Local fixture response. No request was sent."}]);setInput("");setPastedContext("");setAttachmentIds([])};
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setPickerOpen(true)}};document.addEventListener("keydown",shortcut);return()=>document.removeEventListener("keydown",shortcut)},[]);
 return <WorkspaceFrame sidebar={<AppSidebar balance={1234.5} displayName="Chat reviewer" isAdmin={false} activePath="/chat" />} topbar={<WorkspaceTopbar balance={1234.5} identity="Chat reviewer" offline />}>
 <ChatWorkspace {...{messages,busy,exact,models,modelId,setModelId,mode,setMode,focusComposer,pickerOpen,setPickerOpen,dragActive,setDragActive,input,setInput,pastedContext,setPastedContext,attachmentIds,setAttachmentIds,files,textareaRef,fileInputRef,submit,voiceActive,projectId,setProjectId,projects,deepThink,setDeepThink,privateMode,setPrivateMode,setConversationId,error,copiedKey,stopGeneration}}
 conversationKey={conversationId} popularModels={models.filter(m=>m.available)} activeModelName={exact?.name||"Sample model"} processingSeconds={3} voiceSeconds={0} enhancing={false} features={{private_chat:true,prompt_enhancer:true}} supportsReasoning={!exact||!!exact.capabilities?.includes("reasoning")} selectedProject={projects.find(p=>p.id===projectId)}
 uploadFiles={async selected=>{if(!selected)return;const local=Array.from(selected).map((file,i)=>({id:`local-${i}`,name:file.name,size_bytes:file.size,extraction_status:"ready"}));setFiles(current=>[...current,...local]);setAttachmentIds(current=>[...current,...local.map(f=>f.id)])}}
 handlePaste={event=>{const text=event.clipboardData.getData("text");const context=pastedChatContext(text);if(context!==null){event.preventDefault();setPastedContext(context)}}}
 handleComposerKeyDown={event=>{const action=chatComposerKeyAction({key:event.key,shiftKey:event.shiftKey,isComposing:event.nativeEvent.isComposing},busy);if(action==="send"){event.preventDefault();submit()}if(action==="stop")stopGeneration()}}
 startVoiceInput={()=>setVoiceActive(v=>!v)} cancelVoiceInput={()=>setVoiceActive(false)} enhancePrompt={async()=>setInput(v=>`Clarified local prompt: ${v}`)}
 copyMessage={async(content,key)=>{await navigator.clipboard.writeText(content);setCopiedKey(key)}} editPrompt={index=>{setInput(messages[index].content);setMessages(messages.slice(0,index));focusComposer()}} regenerate={()=>setError("Synthetic retry requested. No API call.")} branchAt={index=>setMessages(messages.slice(0,index+1))} />
 </WorkspaceFrame>;
}
