import {chromium,webkit} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const retired=await fs.readFile('docs/mobile-phase6/retired-admin-global.css.txt','utf8'),results=[];
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 for(const width of [320,1366]){
  const page=await browser.newPage({viewport:{width,height:width===320?568:768},reducedMotion:'no-preference'});
  await page.route('**/*',async r=>{const u=new URL(r.request().url());if((/^https?:$/.test(u.protocol)&&u.origin!=='http://127.0.0.1:3100')||!['GET','HEAD','OPTIONS'].includes(r.request().method()))await r.abort();else await r.continue()});
  await page.goto('http://127.0.0.1:3100/responsive-fixture?surface=admin',{waitUntil:'networkidle'});
  const read=()=>page.evaluate(()=>Object.fromEntries(['.admin-header','.admin-tabs','.admin-metric-grid','.admin-metric','.admin-dashboard-grid','.admin-live i'].map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return [selector,Object.fromEntries(['display','height','width','padding','gap','grid-template-columns','font-size','color','background-color','border-radius','position','overflow','animation-name'].map(p=>[p,s.getPropertyValue(p)]))]})));
  const current=await read();await page.evaluate(css=>{const style=document.createElement('style');style.textContent=css;document.head.prepend(style)},retired);const duplicated=await read();assert.deepEqual(current,duplicated,'Retiring exact global copies must preserve computed layout');results.push({engine,width,current,duplicated,identical:true});await page.close();
 }await browser.close();
}await fs.writeFile('docs/mobile-phase6/css-retirement-computed.json',JSON.stringify(results,null,2)+'\n');console.log('PASS: identical computed admin layout with/without retired copies in four engine/size scenarios');
