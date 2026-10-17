import {chromium,webkit} from '@playwright/test';
import fs from 'node:fs/promises';
const label=process.argv[2]||'after';if(!/^[a-z-]+$/.test(label))throw Error('Invalid label');
const results=[];
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if((/^https?:$/.test(u.protocol)&&u.origin!=='http://127.0.0.1:3100')||!['GET','HEAD','OPTIONS'].includes(r.request().method()))await r.abort();else await r.continue()});
 await page.goto('http://127.0.0.1:3100/responsive-fixture?studio=video',{waitUntil:'networkidle'});
 const rail=page.locator('[aria-label="Available video models"]');await rail.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
 await page.evaluate(()=>{const el=document.querySelector('[aria-label="Available video models"]');let proto=el;let descriptor;while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'scrollLeft');proto=Object.getPrototypeOf(proto)}window.__writes=0;Object.defineProperty(el,'scrollLeft',{get(){return descriptor.get.call(this)},set(v){window.__writes++;descriptor.set.call(this,v)}})});
 const sample=async()=>{await page.evaluate(()=>window.__writes=0);await page.waitForTimeout(1000);return page.evaluate(()=>({writes:window.__writes,position:document.querySelector('[aria-label="Available video models"]').scrollLeft,rect:document.querySelector('[aria-label="Available video models"]').getBoundingClientRect().toJSON()}))};
 const visible=await sample();await page.locator('.app-content').evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:'instant'}));await page.waitForTimeout(200);const offscreen=await sample();
 await rail.scrollIntoViewIfNeeded();await page.waitForTimeout(200);const resumed=await sample();results.push({engine:name,visible,offscreen,resumed});console.log(name,JSON.stringify(results.at(-1)));await browser.close();
}await fs.mkdir('docs/mobile-phase6/performance',{recursive:true});await fs.writeFile(`docs/mobile-phase6/performance/rail-${label}.json`,JSON.stringify(results,null,2)+'\n');
