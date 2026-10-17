// Additional local lab measurement, not authenticated E2E or a device SLA.
import './mobile-workspace-production-harness.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
const root=process.cwd(),directory=path.join(root,'test-results/phase5-production-component');
const output=path.join(root,'test-results/phase6-production-library'),samples=[];fs.mkdirSync(output,{recursive:true});
const server=http.createServer((request,response)=>{
 if(!/^(127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host||'')||request.method!=='GET'){response.writeHead(403).end();return}
 const url=new URL(request.url,'http://127.0.0.1');let file;
 if(url.pathname==='/chat.js')file=path.join(directory,'chat.js');
 else if(url.pathname==='/')file=path.join(directory,'index.html');
 else {const asset=url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname;file=path.resolve(root,'public','.'+(asset||'/'));if(!file.startsWith(path.resolve(root,'public')+path.sep)){response.writeHead(404).end();return}}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return}
 response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();try{for(const [width,height]of[[390,844],[1366,768]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width===390,isMobile:width===390,reducedMotion:'no-preference',serviceWorkers:'block'});
   try{
    await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base||!['GET','HEAD','OPTIONS'].includes(r.method())||u.pathname.startsWith('/api/'))await route.abort();else await route.continue()});
    const page=await context.newPage(),errors=[],apis=[];
    await page.addInitScript(()=>{window.dateFormatterConstructions=0;Intl.DateTimeFormat=new Proxy(Intl.DateTimeFormat,{construct(target,args){window.dateFormatterConstructions++;return Reflect.construct(target,args)}})});
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
    const start=Date.now();await page.goto(base+'/?surface=history&state=stress',{waitUntil:'domcontentloaded'});
    await expect(page.locator('html')).toHaveAttribute('data-workspace-data-ready','history',{timeout:45000});
    const readyMs=Date.now()-start;await expect(page.locator('.library-card-chat')).toHaveCount(500);
    const initialMeta=await page.locator('.library-card-chat .library-meta').first().textContent();
    const searchStart=Date.now();await page.getByRole('textbox',{name:'Search library'}).fill('Product research 499 ');await expect(page.locator('.library-card-chat')).toHaveCount(1);const searchMs=Date.now()-searchStart;
    expect(await page.locator('.library-card-chat .library-meta').first().textContent()).toBe(initialMeta);
    expect(errors).toEqual([]);expect(apis).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:path.join(output,`library-${name}-${width}.png`)});
    samples.push({engine:name,width,height,rows:500,readyMs,searchMs,dateFormatterConstructions:await page.evaluate(()=>window.dateFormatterConstructions),initialMeta,filteredMeta:await page.locator('.library-card-chat .library-meta').first().textContent(),status:'PASS',errors,apis});
   }finally{await context.close()}
  }}finally{await browser.close()}
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({scope:'Production React createRoot presentation only; not Next SSR hydration, backend E2E, Web Vitals or hardware acceptance',normalMotion:true,samples},null,2));console.log(JSON.stringify(samples));
}finally{server.close()}
