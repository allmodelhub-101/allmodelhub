// Local presentation audit. No sessions, external requests, or mutating requests.
import {chromium,webkit} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const label=process.argv[2]||'after';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid evidence label');
const dir=`docs/mobile-phase6/${label}`;await fs.mkdir(dir,{recursive:true});
const scenes=label==='stress'?[['homepage','/'],['chat-stress','/responsive-fixture?chat=stress'],['history-stress','/responsive-fixture?surface=history&state=stress'],['admin-stress','/responsive-fixture?surface=admin&state=stress'],...['details','proof','success'].map(s=>[`wallet-${s}`,`/responsive-fixture?surface=wallet&state=${s}`]),...['battle','templates','notifications'].map(s=>[s,`/responsive-fixture?surface=${s}`])]:[['login','/auth/login'],['legal','/privacy'],['chat','/responsive-fixture?chat=long'],...['history','projects','models','files','settings','support','usage','wallet','admin'].map(s=>[s,`/responsive-fixture?surface=${s}&state=populated`]),...['image','video','audio'].map(s=>[s,`/responsive-fixture?studio=${s}&state=completed`])];
const results=[];
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:768},reducedMotion:'no-preference'});
  await context.route('**/*',async r=>{const u=new URL(r.request().url());if((/^https?:$/.test(u.protocol)&&u.origin!=='http://127.0.0.1:3100')||!['GET','HEAD','OPTIONS'].includes(r.request().method()))await r.abort();else await r.continue()});
  await context.addInitScript(()=>{localStorage.setItem('amh-theme','light');window.__audit={shifts:0,longTasks:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__audit.shifts+=e.value}).observe({type:'layout-shift',buffered:true});try{new PerformanceObserver(list=>{window.__audit.longTasks.push(...list.getEntries().map(e=>e.duration))}).observe({type:'longtask',buffered:true})}catch{/* unsupported in WebKit */}});
  for(const [name,path]of scenes){
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:3100${path}`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   if(name==='admin-stress')await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Users',exact:true}).click();
   const axe=label==='stress'?{violations:[],incomplete:[{id:'not-run-performance-profile-only',nodes:[]}]}:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   const metrics=await page.evaluate(async()=>{const frames=[];let last=performance.now();await new Promise(resolve=>{const start=last;function frame(t){frames.push(t-last);last=t;if(t-start<750)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,...window.__audit,frames,animations:document.getAnimations().map(a=>({name:a.animationName,state:a.playState})),navigation:performance.getEntriesByType('navigation').map(n=>({domContentLoaded:n.domContentLoadedEventEnd,duration:n.duration}))}});
   if(label==='stress'||['login','chat','wallet','admin','video'].includes(name))await page.screenshot({path:`${dir}/${engine}-${width}-${name}.png`,style:'nextjs-portal{visibility:hidden}'});
   const record={engine,width,name,path,errors,metrics,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:axe.incomplete.map(v=>({id:v.id,count:v.nodes.length}))};results.push(record);await fs.writeFile(`${dir}/audit.json`,JSON.stringify(results,null,2)+'\n');console.log(`${engine} ${width} ${name}: ${label==='stress'?'performance sample; axe not run':record.violations.map(v=>`${v.id}(${v.nodes.length})`).join(', ')||'no automated WCAG violations'}`);await page.close();
  }await context.close();
 }await browser.close();
}
