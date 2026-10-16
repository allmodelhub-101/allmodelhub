import fs from 'node:fs';
import {chromium,webkit,expect} from '@playwright/test';
// Requires a local Next production build/server with LOCAL_RESPONSIVE_FIXTURES=1.
// No sessions, form submissions, external requests or mutating requests.
const base='http://127.0.0.1:3101',results=[];
fs.mkdirSync('docs/mobile-phase3/next-production',{recursive:true});
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();
 try{for(const [width,height]of[[390,844],[768,1024],[1366,768]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
  try{
   await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue()});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const path of ['/auth/login','/auth/signup','/privacy']){
    const response=await page.goto(base+path,{waitUntil:'networkidle'});expect(response.status()).toBe(200);
    if(path.startsWith('/auth/')){const theme=page.locator('.auth-nav-actions .theme-toggle');await expect(theme).toHaveAttribute('aria-label',/Switch to/);await expect(theme).toBeInViewport()}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width===390&&path==='/auth/login')await page.screenshot({path:`docs/mobile-phase3/next-production/${name}-login.png`,animations:'disabled'});
    results.push({browser:name,width,height,path,status:'PASS: production public rendering'});
   }
   for(const path of ['/responsive-fixture','/responsive-fixture?chat=welcome']){
    const response=await context.request.get(base+path);expect(response.status()).toBe(404);expect(await response.text()).not.toContain('Chat workspace');
    results.push({browser:name,width,height,path,status:'PASS: production fixture disabled despite opt-in flag'});
   }
   expect(errors,'Next production runtime errors').toEqual([]);
  }finally{await context.close()}
 }}finally{await browser.close()}
}
fs.writeFileSync('docs/mobile-phase3/next-production/results.json',JSON.stringify(results,null,2)+'\n');
console.log(`${results.length} Next production public-render / fixture-guard checks passed`);
