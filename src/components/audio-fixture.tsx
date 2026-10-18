"use client";
import {useState} from 'react';
import {AudioStudio} from './audio-studio';
import {TtsView,type TtsViewProps} from './tts-client';
import {AudioGenerationView,audioModeCopy,type AudioGenerationViewProps} from './audio-generation-client';
const voices=[{value:'sample',label:'Sample · Fixture voice',note:'Local presentation only'},{value:'alternate',label:'Alternate · Fixture voice',note:'Local presentation only'}];
const model={id:'local-audio',name:'Sample audio model',tier:'balanced',available:true,capabilities:['tts','music','sound-effects'],retail:{flatCredits:0}};
const unavailable={...model,id:'unavailable-audio',name:'Sample unavailable',available:false};
export function AudioFixture({state}:{state:string}){
 return <AudioStudio panels={{speech:<SpeechFixture state={state}/>,music:<GenerationFixture state={state} mode="music"/>,sfx:<GenerationFixture state={state} mode="sfx"/>}}/>;
}
function SpeechFixture({state}:{state:string}){
 const [text,setText]=useState(''),[voice,setVoice]=useState('sample'),[modelId,setModelId]=useState(model.id),[languageCode,setLanguageCode]=useState('en'),[voiceSpeed,setVoiceSpeed]=useState('1'),[advanced,setAdvanced]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(state==='queued'),[url,setUrl]=useState<string|undefined>(state==='completed'?'/responsive-fixture/audio':undefined);
 const props:TtsViewProps={text,setText,setVoice,languageCode,setLanguageCode,voiceSpeed,setVoiceSpeed,advanced,setAdvanced,confirmed,setConfirmed,busy,url,setUrl,credits:undefined,models:[model,unavailable],modelId,setModelId,selectedVoice:voice,voices,selectedModel:model,asyncKling:false,scriptLimit:10000,estimate:0,expensive:false,error:state==='error'?'Synthetic speech failure. No request was sent.':'',submit:async event=>{event.preventDefault();setBusy(true)}};
 return <TtsView {...props}/>;
}
function GenerationFixture({state,mode}:{state:string;mode:'music'|'sfx'}){
 const [prompt,setPrompt]=useState(''),[modelId,setModelId]=useState(model.id),[job,setJob]=useState<AudioGenerationViewProps['job']>(state==='idle'?null:{status:state==='error'?'failed':state,error_message:'Synthetic audio failure. No request was sent.',...(state==='completed'?{result_urls:['/responsive-fixture/audio']}: {})});
 const props:AudioGenerationViewProps={mode,prompt,setPrompt,modelId,setModelId,models:[model,unavailable],job,setJob,busy:false,error:'',projectId:'',model,estimate:0,activeJob:!!job&&job.status==='queued',failed:job?.status==='failed',resultUrl:job?.result_urls?.[0],details:audioModeCopy[mode],submit:async event=>{event.preventDefault();setJob({status:'queued'})}};
 return <AudioGenerationView {...props}/>;
}
