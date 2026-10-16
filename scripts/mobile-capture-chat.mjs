import {chromium,expect} from '@playwright/test';
// Refresh evidence only; approved comparison snapshots and before/ stay untouched.
if(process.env.LOCAL_RESPONSIVE_FIXTURES!=='1')throw new Error('Explicit local fixture opt-in required');
const base='http://127.0.0.1:3100',browser=await chromium.launch();
try{for(const [width,height]of[[320,568],[390,844],[844,390],[768,1024],[1366,768]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 try{
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue()});
  await context.addInitScript(()=>localStorage.setItem('amh-theme','light'));
  const page=await context.newPage();
  for(const state of ['welcome','long','attachments']){
   await page.goto(`${base}/responsive-fixture?chat=${state}`,{waitUntil:'networkidle'});
   await expect(page.locator('.chat-workspace')).toHaveAttribute('data-ready','true');
   if(state==='long')await page.getByRole('region',{name:'Message table',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:`docs/mobile-phase3/after/${state}-${width}.png`,animations:'disabled',style:'nextjs-portal{visibility:hidden}'});
  }
  if(width===390){await page.getByRole('button',{name:'Chat controls: project, routing and privacy'}).click();await page.screenshot({path:'docs/mobile-phase3/after/controls-390.png',animations:'disabled',style:'nextjs-portal{visibility:hidden}'})}
 }finally{await context.close()}
}}finally{await browser.close()}
console.log('16 Chat screenshots captured; review images before accepting changes.');
