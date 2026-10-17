import {test,expect} from './safety';
test('hardening stress: long Chat keeps native scroll and composer access',async({page})=>{
 const apis:string[]=[],errors:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/responsive-fixture?chat=stress',{waitUntil:'networkidle'});
 await expect(page.locator('.chat-row')).toHaveCount(160);
 const history=page.getByRole('region',{name:'Conversation',exact:true});await history.evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));await history.focus();await history.press('ArrowDown');expect(await history.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(apis).toEqual([]);expect(errors).toEqual([]);
});
test('hardening stress: 500 library records and admin rows remain searchable',async({page})=>{
 await page.goto('/responsive-fixture?surface=history&state=stress',{waitUntil:'networkidle'});await expect(page.locator('.library-card-chat')).toHaveCount(500);
 await page.getByRole('textbox',{name:'Search library'}).fill('Product research 499 ');await expect(page.locator('.library-card-chat')).toHaveCount(1);
 await page.goto('/responsive-fixture?surface=admin&state=stress',{waitUntil:'networkidle'});await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Users',exact:true}).click();
 await expect(page.locator('tbody tr')).toHaveCount(500);const search=page.getByRole('textbox',{name:'Search users'});await search.fill('demo-user-499');await expect(page.locator('tbody tr')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
