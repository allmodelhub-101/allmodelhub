import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';
const base='http://127.0.0.1:3102',dir='docs/mobile-phase6/homepage-production';
await fs.mkdir(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3102'],{stdio:'ignore',env:{...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'}});
const results=[];
try{
 let ready=false;
 for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Local production server exited');try{if((await fetch(base)).ok){ready=true;break}}catch{/* starting */}await new Promise(r=>setTimeout(r,500))}
 if(!ready)throw Error('Production homepage readiness timeout');
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch();
  try{for(const width of [390,1366])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:width===390?844:768},reducedMotion:'no-preference'});
   try{
    await context.route('**/*',async r=>{const u=new URL(r.request().url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.request().method()))await r.abort();else await r.continue()});
    await context.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base,{waitUntil:'networkidle'});expect(response.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await page.evaluate(()=>document.fonts.ready);
    // Let the finite hero entrance finish; ambient premium motion keeps running.
    await page.locator('.cin-hero-copy').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))});
    const measured=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:getComputedStyle(document.querySelector('#cin-hero-title')).color,overline:getComputedStyle(document.querySelector('.cin-overline')).color,animations:document.getAnimations().map(a=>({name:a.animationName,state:a.playState}))}));
    expect(measured.scroll).toBeLessThanOrEqual(width+1);expect(errors).toEqual([]);
    await page.screenshot({path:`${dir}/${engine}-${width}-${theme}.png`});
    const toggle=page.locator('.theme-toggle').first();await expect(toggle).toHaveAttribute('aria-label',theme==='light'?'Switch to dark theme':'Switch to light theme');await toggle.click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');expect(errors).toEqual([]);
    results.push({engine,width,theme,status:'PASS: actual Next production, normal motion, theme interaction',measured});
   }finally{await context.close()}
  }}finally{await browser.close()}
 }
 await fs.writeFile(`${dir}/results.json`,JSON.stringify(results,null,2)+'\n');console.log(`${results.length} normal-motion production homepage scenarios passed`);
}finally{server.kill()}
