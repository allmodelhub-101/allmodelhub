import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
if(process.env.LOCAL_RESPONSIVE_FIXTURES!=='1')throw new Error('Local development fixture opt-in required');
const base='http://127.0.0.1:3100',results=[];fs.mkdirSync('docs/mobile-phase4/controls',{recursive:true});
const browser=await chromium.launch();try{for(const [width,height]of[[390,844],[844,390],[1366,768]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});try{
 await context.route('**/*',async route=>{const r=route.request();if(new URL(r.url()).origin!==base||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue()});
 const page=await context.newPage(),errors=[],apis=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
 const open=async(studio,state='idle')=>{await page.goto(base+'/responsive-fixture?studio='+studio+'&state='+state,{waitUntil:'networkidle'});await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/)};
 const capture=async name=>{await page.screenshot({path:`docs/mobile-phase4/controls/${name}-${width}.png`,animations:'disabled'});results.push({name,width,height,status:'PASS: actual presentation screenshot'})};
 await open('image');await page.locator('.settings-tool').click();await page.locator('#image-settings-panel').scrollIntoViewIfNeeded();await capture('image-settings');
 await open('image','completed');await page.getByRole('button',{name:'View full image'}).click();await capture('image-viewer');await page.keyboard.press('Escape');
 await open('video');await page.getByRole('button',{name:'Open player ↗'}).click();await capture('video-viewer');await page.keyboard.press('Escape');
 await open('audio','completed');for(const [tab,name]of[['Music','audio-music'],['Sound effects','audio-sfx']]){await page.getByRole('tab',{name:new RegExp(tab)}).click();await page.locator('audio').scrollIntoViewIfNeeded();await capture(name)}
 expect(errors).toEqual([]);expect(apis).toEqual([]);
 }finally{await context.close()}
}}finally{await browser.close()}
fs.writeFileSync('docs/mobile-phase4/controls/results.json',JSON.stringify(results,null,2)+'\n');console.log(results.length+' control screenshots captured');
