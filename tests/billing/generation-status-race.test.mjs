import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../../src/app/api/jobs/[id]/route.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
for(const concurrentStatus of ['completed','settling','failed','cancelled','expired'])test(`a delayed provider processing response cannot overwrite ${concurrentStatus}`,async()=>{
 const id='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
 let row={id,public_id:'public-job',user_id:userId,modality:'audio',model_id:'kling-tts',provider_key:'apimodels',provider_task_id:'provider-task',status:'processing',charged_credits:0},writes=0;
 const admin={from(table){assert.equal(table,'generation_jobs');let patch=null,statuses=null;const eqs={};const query={select(){return query},eq(k,v){eqs[k]=v;return query},in(k,v){assert.equal(k,'status');statuses=v;return query},update(value){patch=value;return query},async single(){assert.equal(eqs.user_id,userId);return{data:{...row},error:null}},async maybeSingle(){assert.deepEqual(statuses,['queued','submitted','processing']);assert.equal(eqs.user_id,userId);if(!statuses.includes(row.status))return{data:null,error:null};writes++;row={...row,...patch};return{data:row,error:null}}};return query}};
 const fail=()=>{throw new Error('No billing mutation is authorized during a stale status update')};
 const mocks={
 '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:userId}}})}})},
 '@/lib/supabase/admin':{createAdminClient:()=>admin},
 '@/lib/generated-assets':{signGeneratedPaths:async()=>[],assertTrustedAssetUrl:fail,persistGeneratedAssets:fail},
 '@/lib/providers':{providerPollTask:async()=>{row={...row,status:concurrentStatus};return{state:'processing'}}},
 '@/lib/notifications':{notifyUser:fail},'@/lib/public-error':{logServerError:fail},
 '@/lib/billing/media-job-billing':{completeMediaGenerationBilling:fail,completeProviderAuthoritativeMediaBilling:fail,failMediaGenerationBilling:fail},
 '@/lib/billing/media-job-billing-core':{mediaUsageFromRequest:fail,normalizeMediaResult:fail,providerFailureIsNonBillable:fail},
 };
 const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]||require(name),mod,mod.exports);
 const response=await mod.exports.GET(new Request('https://modelssuite.com/api/jobs/'+id),{params:Promise.resolve({id})});
 assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.job.status,concurrentStatus);assert.equal(payload.job.charged_credits,0);assert.equal(writes,0);
});
