"use client";

import {useRef,useState} from "react";
import {ImageStudioView,type ImageStudioViewProps} from "./image-studio";
import {WorkspaceFrame} from "./workspace-frame";
import {WorkspaceTopbar} from "./workspace-topbar";
import {AppSidebar} from "./app-sidebar";

const imageModels:ImageStudioViewProps['models']=[
 {id:'local-image',name:'Sample image model',modality:'image',providerFamily:'Fixture',tier:'balanced',available:true,capabilities:['editing','multi-reference'],uiSchema:{inputModes:['text','image'],aspectRatios:['1:1','16:9','9:16'],resolutionOptions:['1K','2K'],maxReferences:3}},
 {id:'local-image-text',name:'Sample text-only model',modality:'image',tier:'budget',available:true,uiSchema:{aspectRatios:['1:1'],maxReferences:0}},
 {id:'local-image-unavailable',name:'Sample unavailable',modality:'image',tier:'premium',available:false}
];
export function StudioFixture({studio,state='idle'}:{studio:string;state?:string}){
 return <WorkspaceFrame sidebar={<AppSidebar balance={1234.5} displayName="Studio reviewer" isAdmin={false} activePath={studio==='image'?'/images':`/${studio}`} />} topbar={<WorkspaceTopbar balance={1234.5} identity="Studio reviewer" offline />}><ImageFixture state={state}/></WorkspaceFrame>;
}
function ImageFixture({state}:{state:string}){
 const fileInputRef=useRef<HTMLInputElement|null>(null),promptInputRef=useRef<HTMLTextAreaElement|null>(null),settingsRef=useRef<HTMLDivElement|null>(null),settingsButtonRef=useRef<HTMLButtonElement|null>(null);
 const [modelId,setModelId]=useState(imageModels[0].id),[prompt,setPrompt]=useState(''),[aspect,setAspect]=useState('1:1'),[resolution,setResolution]=useState('1K');
 const [references,setReferences]=useState<ImageStudioViewProps['references']>(state==='references'?[{id:'reference-0',name:'A_very_long_reference_filename_'.repeat(6)+'.png',previewUrl:'/image-studio-inspiration-v2.webp',size:2048}]:[]);
 const [job,setJob]=useState<ImageStudioViewProps['job']>(state==='idle'||state==='references'?null:{id:'synthetic-image-job',status:state==='error'?'failed':state,error_message:'Synthetic provider failure. No request was sent.',...(state==='completed'?{result_urls:['/image-studio-inspiration-v2.webp']}: {})});
 const [pickerOpen,setPickerOpen]=useState(false),[inspectorOpen,setInspectorOpen]=useState(false),[confirmed,setConfirmed]=useState(false),[dragActive,setDragActive]=useState(false),[motionPaused,setMotionPaused]=useState(false),[error,setError]=useState('');
 const model=imageModels.find(m=>m.id===modelId),aspectRatios=model?.uiSchema?.aspectRatios||[],resolutions=model?.uiSchema?.resolutionOptions||[],maxReferences=model?.uiSchema?.maxReferences||0;
 const addReferences=async(files:File[])=>{const local=files.slice(0,Math.max(0,maxReferences-references.length)).map((file,i)=>({id:`local-${i}-${file.name}`,name:file.name,size:file.size,previewUrl:'/image-studio-inspiration-v2.webp'}));setReferences(v=>[...v,...local])};
 const resultUrl=job?.result_urls?.[0],generating=!!job&&!['completed','failed'].includes(job.status||'');
 const props:ImageStudioViewProps={fileInputRef,promptInputRef,settingsRef,settingsButtonRef,models:imageModels,modelId,setModelId,prompt,setPrompt,aspect,setAspect,setResolution,references,job,submitting:false,uploading:false,actionBusy:false,error,confirmed,setConfirmed,pickerOpen,setPickerOpen,inspectorOpen,setInspectorOpen,copied:'',dragActive,setDragActive,motionPaused,setMotionPaused,model,aspectRatios,resolutions,effectiveResolution:resolution,maxReferences,expensive:false,supportsEditing:maxReferences>0,supportsMultipleReferences:maxReferences>1,generating,resultUrl,status:{step:'Queued',title:'Your request is in line'},addReferences,pasteReference:()=>{},pasteFromClipboard:async()=>setError('Local fixture: clipboard upload is not performed.'),openSettings:()=>setInspectorOpen(true),submit:async event=>{event.preventDefault();setJob({status:'queued'})},removeReference:id=>setReferences(v=>v.filter(f=>f.id!==id)),resetResult:()=>setJob(null),applyAsReference:async()=>{setJob(null);setReferences([{id:'result',name:'Synthetic result.png',previewUrl:'/image-studio-inspiration-v2.webp',size:2048}])},animateInVideo:async()=>{},copySettings:async()=>{},shareResult:async()=>{},crossModalityHandoffs:false};
 return <ImageStudioView {...props}/>;
}
