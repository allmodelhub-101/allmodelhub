"use client";

// Synthetic state adapters only. Production controllers are never mounted here.
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {HistoryClientView,type HistoryClientViewProps as HP} from './history-client';
import {FilesClientView,type FilesClientViewProps as FP} from './files-client';
import {ProjectsClientView,type ProjectsClientViewProps as PP} from './simple-forms';
import {NotificationsClientView,type NotificationsClientViewProps as NP} from './workspace-clients';
import {ModelBattleView,type ModelBattleViewProps as BP} from './model-battle';
import {TemplateLibrary,type PromptTemplate} from './template-library';
import {ModelsMarketplace} from './models-marketplace';
import type {CatalogModel} from '@/lib/models';
import {WorkspaceFrame} from './workspace-frame';
import {WorkspaceTopbar} from './workspace-topbar';
import {AppSidebar} from './app-sidebar';
import {WalletFixture} from './wallet-fixture';
import {AccountFixture} from './account-fixture';
import {FilesWorkspace} from './files-workspace';
const date='2026-10-16T12:00:00Z';
const long='Research_'.repeat(18);
const noop=async()=>{};
const models:CatalogModel[]=['text','image','video','audio'].map((modality,i)=>({id:`synthetic-${i}`,name:i===0?`Sample ${long}`:`Sample ${modality} model`,providerFamily:'Fixture',tier:'balanced',modality:modality as CatalogModel['modality'],description:'Synthetic catalog entry for local presentation review. No provider is connected.',upstreamModel:'none',markup:2,capabilities:['reasoning','fast'],available:i!==3}));
const templates:PromptTemplate[]=['Research','Writing','Education'].map((category,i)=>({id:`template-${i}`,slug:`sample-${i}`,category,title:`Sample ${category} workflow`,description:'A useful starting point with a detailed brief. '+long,prompt:'Synthetic prompt',language:'en',pakistan_focused:false}));
export function WorkspaceDataFixture({surface,state='populated'}:{surface:string;state?:string}){
 useEffect(()=>{document.documentElement.dataset.workspaceDataReady=surface;return()=>{delete document.documentElement.dataset.workspaceDataReady}},[surface]);
 return <WorkspaceFrame sidebar={<AppSidebar balance={1234.5} displayName="Workspace reviewer" isAdmin={false} activePath={`/${surface}`}/>} topbar={<WorkspaceTopbar balance={1234.5} identity="Workspace reviewer" offline/>}>{surface==='wallet'?<WalletFixture state={state}/>:['settings','support','usage'].includes(surface)?<AccountFixture surface={surface} state={state}/>:surface==='files'?<FilesWorkspace><Files state={state}/></FilesWorkspace>:surface==='history'?<History state={state}/>:surface==='projects'?<div className="projects-page"><Projects state={state}/></div>:surface==='notifications'?<Notifications state={state}/>:surface==='battle'?<Battle state={state}/>:surface==='models'?<div className="model-marketplace-page"><ModelsMarketplace models={state==='empty'?[]:models} fxRate={280}/></div>:<TemplateLibrary templates={state==='empty'?[]:templates}/>}</WorkspaceFrame>;
}
function History({state}:{state:string}){
 const [q,setQ]=useState(''),[view,setView]=useState<HP['view']>('all'),[sort,setSort]=useState<HP['sort']>('recent'),[layout,setLayout]=useState<HP['layout']>('grid'),[detail,setDetail]=useState<HP['detail']>(null);
 const [conversations,setConversations]=useState<HP['conversations']>(state==='empty'?[]:[{id:'local-chat',title:'Product research '+long,mode:'chat',pinned:false,updated_at:date}]);
 const [favoriteJobs,setFavoriteJobs]=useState<string[]>([]),[favoriteFiles,setFavoriteFiles]=useState<string[]>([]);
 const files:HP['files']=state==='empty'?[]:[{id:'local-file',name:long+'.pdf',mime_type:'application/pdf',size_bytes:4096,extraction_status:'ready',created_at:date}];
 const jobs:HP['jobs']=state==='empty'?[]:[{id:'local-image',modality:'image',model_id:'Sample model',status:state==='error'?'failed':'completed',prompt:'A quiet mountain sunrise '+long,charged_credits:12.5,created_at:date,...(state==='media'?{result_urls:['/image-studio-inspiration-v2.webp']}:{})}];
 return <HistoryClientView {...{q,setQ,view,setView,sort,setSort,layout,setLayout,detail,setDetail,conversations,jobs,files,favoriteJobs,favoriteFiles,loading:state==='loading',detailLoading:false,crossModalityHandoffs:false,patchConversation:async(id,body)=>setConversations(v=>v.map(c=>c.id===id?{...c,...body}:c)),removeConversation:noop,removeFile:noop,openFileDetail:async item=>setDetail({kind:'file',item}),toggleFavorite:async(kind,id,current)=>{const setter=kind==='job'?setFavoriteJobs:setFavoriteFiles;setter(v=>current?v.filter(x=>x!==id):[...v,id])}}}/>;
}
function Files({state}:{state:string}){
 const inputRef=useRef<HTMLInputElement>(null);const [selected,setSelected]=useState<File|null>(null),[projectId,setProjectId]=useState(''),[query,setQuery]=useState(''),[dragging,setDragging]=useState(false),[status,setStatus]=useState(state==='error'?'Synthetic upload failure. No file was uploaded.':'');
 const files:FP['files']=state==='empty'?[]:[{id:'local-file',name:long+'.pdf',size_bytes:4096,extraction_status:'ready'},{id:'local-stored',name:'Reference-notes.txt',size_bytes:128,extraction_status:'unsupported'}];
 const choose=(file:File|null)=>{if(file&&file.size>10485760){setSelected(null);setStatus('This plan allows up to 10 MB per file.')}else{setSelected(file);setStatus('')}};
 return <FilesClientView {...{inputRef,selected,setSelected,projectId,setProjectId,query,setQuery,dragging,setDragging,status,busy:state==='loading',files,projects:[{id:'local-project',name:long}],quota:{tier:'free',label:'Free storage',usedBytes:4096,limitBytes:26214400,remainingBytes:26210304,maxFileBytes:10485760,percent:1,lifetimePurchasedCredits:0},onFileChange:e=>choose(e.target.files?.[0]||null),onDrop:e=>{e.preventDefault();setDragging(false);choose(e.dataTransfer.files[0]||null)},upload:async e=>{e.preventDefault();setStatus('Local preview only. No upload performed.')},remove:noop}}/>;
}
function Projects({state}:{state:string}){
 const nameInput=useRef<HTMLInputElement>(null);const [name,setName]=useState(''),[instructions,setInstructions]=useState(''),[sort,setSort]=useState<PP['sort']>('updated'),[view,setView]=useState<PP['view']>('grid'),[activeProject,setActiveProject]=useState(''),[status,setStatus]=useState('');
 const projects:PP['projects']=state==='empty'?[]:[{id:'local-project',name:'Campaign '+long,instructions:'A detailed brief for consistent research, writing and creative work. '+long,updated_at:date},{id:'local-second',name:'Research notes',instructions:'Keep source material together.',updated_at:date}];
 return <ProjectsClientView {...{nameInput,name,setName,instructions,setInstructions,sort,setSort,view,setView,activeProject,status,projects,activate:setActiveProject,submit:async e=>{e.preventDefault();setStatus('Local preview only. No project created.')},edit:noop,remove:noop}}/>;
}
function Notifications({state}:{state:string}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<NP['filter']>('all');const [items,setItems]=useState<NP['items']>(state==='empty'?[]:[{id:'local-notice',type:'support',title:'Support replied '+long,body:'A synthetic support message. '+long,created_at:date},{id:'local-payment',type:'payment',title:'Payment update',body:'Synthetic payment status only.',created_at:date,read_at:date}]);
 return <NotificationsClientView {...{items,query,setQuery,filter,setFilter,loading:state==='loading',markRead:async id=>setItems(v=>v.map(n=>!id||n.id===id?{...n,read_at:date}:n))}}/>;
}
function Battle({state}:{state:string}){
 const battleModels:BP['models']=[{id:'local-a',name:'Sample research model',modality:'text',tier:'balanced',available:true},{id:'local-b',name:'Sample reasoning model '+long,modality:'text',tier:'premium',available:true},{id:'local-c',name:'Unavailable sample',modality:'text',tier:'budget',available:false}];
 const [selected,setSelected]=useState<string[]>(['local-a','local-b']),[prompt,setPrompt]=useState(''),[winner,setWinner]=useState<string|null>(null),[outputs,setOutputs]=useState<BP['outputs']>(state==='populated'?{'local-a':{text:'A detailed response.\n'.repeat(40)+long,meta:'Sample model · 1.2500 Credits'},'local-b':{text:'An alternative perspective. '+long}}:state==='error'?{'local-a':{text:'',error:'Synthetic model failure. No provider request was sent.'}}:{});
 return <ModelBattleView {...{models:battleModels,selected,setSelected,prompt,setPrompt,winner,setWinner,outputs,busy:state==='loading',selectedModels:battleModels.filter(m=>selected.includes(m.id)),hasResults:Object.values(outputs).some(o=>o.text||o.error),toggle:id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):v.length<3?[...v,id]:v),resetComparison:()=>{setPrompt('');setOutputs({});setWinner(null)},submit:async(e:FormEvent)=>{e.preventDefault();setOutputs({'local-a':{text:'Synthetic local comparison only.'}})},copyResponse:noop}}/>;
}
