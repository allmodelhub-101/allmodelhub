import {test,expect} from './safety';import fs from 'node:fs/promises';
for(const route of ['/auth/login','/auth/signup','/auth/update-password','/privacy','/terms','/refunds','/acceptable-use'])test(`public account policy ${route}`,async({page,context},info)=>{
 const api:string[]=[],errors:string[]=[];await context.route('**/api/**',async r=>{api.push(r.request().url());await r.abort()});page.on('pageerror',e=>errors.push(e.message));await page.goto(route,{waitUntil:'networkidle'});await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
 if(route.startsWith('/auth/')){const inputs=page.locator('input:not([type=checkbox]):not([type=hidden])');for(const input of await inputs.all()){await input.fill(await input.getAttribute('type')==='email'?'reviewer@example.invalid':'Synthetic local entry');expect(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)}}
 const size=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));expect(size.s).toBeLessThanOrEqual(size.w+1);expect(api).toEqual([]);expect(errors).toEqual([]);
 if(process.env.PW_PUBLIC_CAPTURE){const dir='docs/mobile-phase5/batch-d/after/public';await fs.mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/${route.replaceAll('/','-')}-${info.project.name}.png`,animations:'disabled'})}
});
