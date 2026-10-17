import {test,expect} from './safety';
import fs from 'node:fs/promises';
if(process.env.PW_ACCOUNT_CAPTURE)for(const surface of ['settings','support','usage'])test(`account evidence ${surface}`,async({page,context},info)=>{
 const api:string[]=[];await context.route('**/api/**',async r=>{api.push(r.request().url());await r.abort()});
 const phase=process.env.PW_ACCOUNT_CAPTURE!;if(!['before','after'].includes(phase))throw Error('Invalid capture phase');
 const theme=process.env.PW_ACCOUNT_THEME||'light';await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
 await page.goto(`/responsive-fixture?surface=${surface}`,{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('data-workspace-data-ready',surface);
 const dir=`docs/mobile-phase5/batch-b/${phase}${theme==='dark'?'/dark':''}`;await fs.mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/${surface}-${info.project.name}.png`,animations:'disabled'});
 if(phase==='after'){if(surface==='support')await page.locator('.support-ticket-row').click();const target=page.locator(surface==='settings'?'.settings-delete-zone':surface==='support'?'.support-conversation':'.usage-receipts').first();await target.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${surface}-content-${info.project.name}.png`,animations:'disabled'})}expect(api).toEqual([]);
});
