import {test,expect} from './safety';import fs from 'node:fs/promises';
const tabs=['Overview','Billing & Pricing','Payments','Models','Providers','Users','Jobs','Support','Platform'];
for(const theme of ['light','dark'])test(`admin all sections ${theme}`,async({page,context},info)=>{
 const api:string[]=[],errors:string[]=[];await context.route('**/api/**',async r=>{api.push(r.request().url());await r.abort()});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto('/responsive-fixture?surface=admin',{waitUntil:'networkidle'});await expect(page.getByRole('navigation',{name:'Admin sections'})).toBeVisible();
 for(const [i,name]of tabs.entries()){const button=page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-current','page');const sizes=await page.locator('.app-content').evaluate(e=>({doc:document.documentElement.scrollWidth,v:innerWidth,canvas:e.scrollWidth,w:e.clientWidth}));expect(sizes.doc).toBeLessThanOrEqual(sizes.v+1);expect(sizes.canvas).toBeLessThanOrEqual(sizes.w+1);
 if(process.env.PW_ADMIN_CAPTURE){const phase=process.env.PW_ADMIN_CAPTURE;if(!['before','after'].includes(phase))throw Error('Invalid phase');const dir=`docs/mobile-phase5/batch-d/${phase}/${theme}`;await fs.mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/admin-${i}-${info.project.name}.png`,animations:'disabled'})}
 if(name==='Users'){const search=page.getByRole('textbox',{name:'Search users'});await search.fill('no-match');await expect(page.locator('tbody tr')).toHaveCount(0);await search.fill('reviewer');await expect(page.locator('tbody tr')).toHaveCount(1)}
 if(name==='Payments'){await page.getByRole('button',{name:'Approve',exact:true}).click();await expect(page.getByText('Local preview only. No administrative action performed.')).toBeVisible()}
 for(const region of await page.locator('.table-wrap[role=region]').all()){await region.scrollIntoViewIfNeeded();await region.focus();await expect(region).toBeFocused()}
 }
 expect(api).toEqual([]);expect(errors).toEqual([]);
});
