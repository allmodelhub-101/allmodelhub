import fs from 'node:fs';
import {chromium} from '@playwright/test';
if(process.env.LOCAL_RESPONSIVE_FIXTURES!=='1')throw new Error('Local fixture opt-in required');
const studio=process.env.STUDIO||'image',stage=process.env.CAPTURE_STAGE||'after';
if(!['image','video','audio'].includes(studio)||!['before','after'].includes(stage))throw new Error('Invalid capture choice');
const browser=await chromium.launch();
try{for(const [width,height]of[[320,568],[390,844],[768,1024],[844,390],[1366,768]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});try{
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!=='http://127.0.0.1:3100'||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue()});
  const page=await context.newPage();
  for(const state of ['idle','completed']){
   await page.goto(`http://127.0.0.1:3100/responsive-fixture?studio=${studio}&state=${state}`,{waitUntil:'networkidle'});
   fs.mkdirSync(`docs/mobile-phase4/${studio}/${stage}`,{recursive:true});await page.screenshot({path:`docs/mobile-phase4/${studio}/${stage}/${state}-${width}.png`,fullPage:true,animations:'disabled',style:'nextjs-portal{visibility:hidden}'});
  }
 }finally{await context.close()}
}}finally{await browser.close()}
console.log(`${studio} ${stage}: 10 screenshots captured; image review required.`);
