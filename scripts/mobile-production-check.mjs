import fs from 'node:fs';
import { chromium,webkit,expect } from '@playwright/test';
// Requires an already built local production server, never a remote deployment.
const base='http://127.0.0.1:3101';const results=[];
fs.mkdirSync('docs/mobile-phase2/after',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();
 for(const [width,height] of [[390,844],[768,1024],[1366,768]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/auth/login','/auth/signup']){
   const response=await page.goto(base+path,{waitUntil:'networkidle'});expect(response.status()).toBe(200);
   const theme=page.locator('.auth-nav-actions .theme-toggle');await expect(theme).toHaveAttribute('aria-label','Switch to dark theme');await expect(theme).toBeVisible();await theme.click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload({waitUntil:'networkidle'});await expect(theme).toHaveAttribute('aria-label','Switch to light theme');await theme.click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`docs/mobile-phase2/after/production-${name}-${width}-${path.split('/').at(-1)}.png`,animations:'disabled'});
   results.push({browser:name,width,path,status:'PASS'});
  }
  const response=await context.request.get(base+'/responsive-fixture');expect(response.status()).toBe(404);results.push({browser:name,width,path:'/responsive-fixture',status:'PASS: production 404 with opt-in flag set'});
  expect(errors).toEqual([]);await context.close();
 }
 await browser.close();
}
fs.writeFileSync('docs/mobile-phase2/production-browser-results.json',JSON.stringify(results,null,2));console.log(`${results.length} production checks passed`);
