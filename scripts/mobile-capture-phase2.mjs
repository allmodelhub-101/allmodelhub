import { chromium, webkit, expect } from '@playwright/test';
import fs from 'node:fs';
const base = 'http://127.0.0.1:3100';
const directory = 'docs/mobile-phase2/after';
fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await engine.launch();
  for(const [width,height] of [[390,844],[768,1024],[1366,768]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if((/^https?:$/.test(u.protocol)&&u.origin!==base)||!['GET','HEAD','OPTIONS'].includes(r.method()))await route.abort();else await route.continue();});
    const page=await context.newPage();
    await page.goto(base+'/responsive-fixture',{waitUntil:'networkidle'});
    await expect(page.locator('.responsive-fixture')).toHaveAttribute('data-ready','true',{timeout:20000});
    await page.keyboard.press('?'); const help=page.getByRole('dialog',{name:'Keyboard shortcuts'});await expect(help).toBeVisible();
    await page.screenshot({path:`${directory}/${name}-${width}-keyboard.png`,animations:'disabled'});
    await page.keyboard.press('Escape');await expect(help).toHaveCount(0);
    await page.getByRole('button',{name:'Open generation center'}).click();
    await page.screenshot({path:`${directory}/${name}-${width}-drawer.png`,animations:'disabled'});await page.keyboard.press('Escape');
    if(width<=900){await page.getByRole('button',{name:'Open more navigation'}).click();await expect(page.getByRole('dialog',{name:'Workspace navigation'})).toBeVisible();await page.screenshot({path:`${directory}/${name}-${width}-more.png`,animations:'disabled'});await page.keyboard.press('Escape');}
    await page.getByRole('button',{name:'Choose fixture model'}).click();await expect(page.getByRole('dialog',{name:'Choose the right intelligence'})).toBeVisible();
    await page.screenshot({path:`${directory}/${name}-${width}-model-picker.png`,animations:'disabled'});await page.keyboard.press('Escape');
    results.push({browser:name,width,height,keyboardHelp:'PASS',generationDrawer:'PASS',modelPicker:'PASS',more:width<=900?'PASS':'not applicable'});
    await context.close();
  }
  await browser.close();
}
fs.writeFileSync('docs/mobile-phase2/overlay-captures.json',JSON.stringify(results,null,2));
console.log(results);
