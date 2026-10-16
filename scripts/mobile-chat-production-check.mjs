// Standalone production-React component verification. No Next route/auth bypass.
import './mobile-chat-production-harness.mjs';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
const root=process.cwd(),directory=path.join(root,'test-results','phase3-production-component'),results=[],computedStyles=[];
const server=http.createServer((request,response)=>{
 if(!/^(127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host||'')||request.method!=='GET'){response.writeHead(403).end();return}
 const url=new URL(request.url,'http://127.0.0.1');let file;
 if(url.pathname==='/chat.js')file=path.join(directory,'chat.js');
 else if(url.pathname==='/'||url.pathname==='/index.html')file=path.join(directory,'index.html');
 else {const asset=url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname;file=path.resolve(root,'public','.'+(asset||'/'));if(!file.startsWith(path.resolve(root,'public')+path.sep)){response.writeHead(404).end();return}}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return}
 response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('docs/mobile-phase3/production',{recursive:true});
try{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{for(const [width,height]of[[390,844],[844,390],[1366,768]])for(const state of ['welcome','long','attachments','error','loading']){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[],apis=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
   await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue()});
   await page.goto(`${base}/?state=${state}`,{waitUntil:'networkidle'});await expect(page.locator('.chat-workspace')).toHaveAttribute('data-ready','true');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(state==='welcome')computedStyles.push({browser:name,width,height,styles:await page.evaluate(()=>Object.fromEntries(['.responsive-workspace','.app-main','.app-content','.chat-workspace','.chat-layout-body','.composer-wrap','.composer','.composer-footer','.composer-tools','.chat-input','.mobile-nav'].map(selector=>{const element=document.querySelector(selector),style=getComputedStyle(element),rect=element.getBoundingClientRect();return [selector,{display:style.display,position:style.position,height:style.height,minHeight:style.minHeight,maxHeight:style.maxHeight,overflowX:style.overflowX,overflowY:style.overflowY,gridTemplateRows:style.gridTemplateRows,padding:style.padding,maxWidth:style.maxWidth,bounds:{top:rect.top,bottom:rect.bottom,width:rect.width}}]})))});
   if(state==='welcome'){await page.getByRole('textbox',{name:'Message',exact:true}).fill('Production React local draft');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('Local fixture response. No request was sent.',{exact:true})).toBeVisible()}
   if(state==='loading'){await page.getByRole('button',{name:'Stop generation'}).click();await expect(page.getByRole('button',{name:'Send message'})).toBeVisible()}
   if(state==='attachments')await expect(page.locator('.attachment-card')).toHaveCount(3);
   if(state==='long')await expect(page.getByRole('region',{name:'Message table',exact:true})).toHaveCount(1);
   if(state==='error')await expect(page.getByRole('alert').filter({hasText:'Request not completed'})).toContainText('Synthetic connection failure');
   if(width===390&&['welcome','attachments','error'].includes(state))await page.screenshot({path:`docs/mobile-phase3/production/${name}-${state}.png`,animations:'disabled'});
   expect(errors,'production component runtime errors').toEqual([]);expect(apis,'production component harness must never call backend APIs').toEqual([]);
   results.push({browser:name,width,height,state,status:'PASS',mode:'production React standalone component bundle; not authenticated Next E2E'});await context.close();
  }}finally{await browser.close()}
 }
 fs.writeFileSync('docs/mobile-phase3/production/results.json',JSON.stringify(results,null,2));fs.writeFileSync('docs/mobile-phase3/production/computed-styles.json',JSON.stringify(computedStyles,null,2)+'\n');console.log(`${results.length} production React component scenarios passed`);
}finally{await new Promise(resolve=>server.close(resolve))}
