import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generationChargeLabel,isActiveGeneration,loadGenerationSnapshot} from '../../src/lib/generation-center.ts';
const job=(id,status='processing')=>({id,public_id:id,modality:'audio',model_id:'kling-tts',status,created_at:'2026-10-18T00:00:00Z'});
const response=data=>new Response(JSON.stringify(data));
test('old active jobs are fetched separately, polled, merged and never resubmitted',async()=>{
 const seen=[];
 const fetcher=async(url,options)=>{seen.push(url);assert.equal(options.cache,'no-store');assert.equal(options.method,undefined);return response(url.includes('active=true')?{jobs:[job('older-active')]}:url.includes('/older-active')?{job:{...job('older-active','completed'),charged_credits:0}}:{jobs:[job('old-failure','failed')]})};
 const result=await loadGenerationSnapshot(fetcher,new AbortController().signal);
 assert.equal(seen.length,3);assert(result.jobs.some(j=>j.id==='older-active'&&j.status==='completed'));assert(result.jobs.some(j=>j.id==='old-failure'&&j.status==='failed'));assert.equal(result.warning,'');
});
test('active status wins over an older list snapshot and terminal jobs are never polled',async()=>{
 const seen=[];
 const result=await loadGenerationSnapshot(async url=>{seen.push(url);return response(url.includes('active=true')?{jobs:[job('running')]}:url.endsWith('/running')?{job:job('running','settling')}:{jobs:[job('running'),job('failed','failed')]})},new AbortController().signal);
 assert.equal(result.jobs.filter(j=>j.id==='running').length,1);assert.equal(result.jobs[0].status,'settling');assert(!seen.some(u=>u.endsWith('/failed')));
});
test('failed status refresh preserves the job and reports stale data instead of pretending success',async()=>{
 const result=await loadGenerationSnapshot(async url=>url.includes('active=true')?response({jobs:[job('running')]}):url.endsWith('/running')?new Response('',{status:503}):response({jobs:[]}),new AbortController().signal);
 assert.equal(result.jobs[0].status,'processing');assert(result.warning.includes('could not refresh'));
 await assert.rejects(()=>loadGenerationSnapshot(async()=>new Response('',{status:401}),new AbortController().signal));
});
test('refresh polling is bounded and provider warnings are shown',async()=>{
 let inFlight=0,max=0;
 const result=await loadGenerationSnapshot(async url=>{if(url.includes('active=true'))return response({jobs:Array.from({length:8},(_,i)=>job(String(i)))});if(url.includes('?'))return response({jobs:[]});inFlight++;max=Math.max(max,inFlight);await new Promise(r=>setTimeout(r,2));inFlight--;return response({job:job(url.split('/').at(-1)),warning:'Provider status unavailable'})},new AbortController().signal);
 assert(max<=3);assert.equal(result.jobs.length,8);assert(result.warning);
});
test('zero is a real final charge; estimates are never presented as final charges',()=>{
 assert.equal(generationChargeLabel({...job('a','completed'),charged_credits:0,estimated_credits:80}),'Charged 0.00 credits');
 assert.equal(generationChargeLabel({...job('a','failed'),charged_credits:null,estimated_credits:80}),'Final charge not recorded');
 assert.equal(generationChargeLabel({...job('a'),estimated_credits:80}),'Estimated 80.00 credits');
 assert(isActiveGeneration(job('a','settling')));assert(!isActiveGeneration(job('a','failed')));
});
test('drawer refresh lifecycle exposes timestamps and errors without removing history',()=>{
 const hook=readFileSync(new URL('../../src/components/use-generation-center.ts',import.meta.url),'utf8'),ui=readFileSync(new URL('../../src/components/workspace-topbar.tsx',import.meta.url),'utf8');
 for(const event of ['focus','online','visibilitychange','amh-wallet-refresh'])assert(hook.includes(event));
 assert(hook.includes('offline || request.current'));assert(hook.includes('request.current?.abort()'));assert(ui.includes('Recent history'));assert(ui.includes('Recorded failure:'));assert(ui.includes('<time dateTime={timestamp}>'));assert(ui.includes('Please refresh'));
});
