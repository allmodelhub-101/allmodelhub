// Standalone production-React component verification. No Next route/auth bypass.
import './mobile-workspace-production-harness.mjs';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
const root=process.cwd(),directory=path.join(root,'test-results','phase5-production-component'),results=[];
const server=http.createServer((request,response)=>{
 if(!/^(127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host||'')||request.method!=='GET'){response.writeHead(403).end();return}
 const url=new URL(request.url,'http://127.0.0.1');let file;
 if(url.pathname==='/responsive-fixture/audio')file=path.join(root,'tests','fixtures','studio-tone.wav');
 else if(url.pathname==='/chat.js')file=path.join(directory,'chat.js');
 else if(url.pathname==='/'||url.pathname==='/index.html')file=path.join(directory,'index.html');
 else {const asset=url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname;file=path.resolve(root,'public','.'+(asset||'/'));if(!file.startsWith(path.resolve(root,'public')+path.sep)){response.writeHead(404).end();return}}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return}
 response.setHeader('Content-Type',file.endsWith('.wav')?'audio/wav':file.endsWith('.mp4')?'video/mp4':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('docs/mobile-phase5/production',{recursive:true});
try{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{for(const [width,height]of[[390,844],[844,390],[1366,768]])for(const surface of ['history','projects','files','templates','models','battle','notifications','settings','support','usage','wallet','admin']){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});try{
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base||!['GET','HEAD','OPTIONS'].includes(r.method())||u.pathname.startsWith('/api/'))await route.abort();else await route.continue()});
 const page=await context.newPage(),errors=[],apis=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
 await page.goto(base+'/?surface='+surface,{waitUntil:'networkidle'});await expect(page.getByRole('main')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);expect(apis).toEqual([]);results.push({engine:name,width,height,surface,status:'PASS'});
 }finally{await context.close()}
 }}finally{await browser.close()}
 }
 fs.writeFileSync('docs/mobile-phase5/production/results.json',JSON.stringify({passed:results.length,results},null,2));console.log(`${results.length} production React presentation checks passed`);
}finally{server.close()}
