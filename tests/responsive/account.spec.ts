import {test,expect} from './safety';
for(const theme of ['light','dark'])for(const surface of ['settings','support','usage'])test(`account ${surface} ${theme}`,async({page,context},info)=>{
 const api:string[]=[],errors:string[]=[];await context.route('**/api/**',async r=>{api.push(r.request().url());await r.abort()});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto(`/responsive-fixture?surface=${surface}`,{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('data-workspace-data-ready',surface);
 const root=page.locator('.app-content');await expect(page.getByRole('main')).toHaveCount(1);
 const geometry=await root.evaluate(e=>({doc:document.documentElement.scrollWidth,viewport:innerWidth,canvas:e.scrollWidth,width:e.clientWidth}));expect(geometry.doc).toBeLessThanOrEqual(geometry.viewport+1);expect(geometry.canvas).toBeLessThanOrEqual(geometry.width+1);
 if(surface==='settings'){
 await page.getByRole('textbox',{name:'Display name',exact:true}).fill('Local reviewer');await page.getByRole('textbox',{name:'Custom instructions'}).fill('Use precise and readable explanations.');
 const checkbox=page.getByRole('checkbox',{name:/Low-bandwidth/});await checkbox.check();await expect(checkbox).toBeChecked();
 const themePicker=page.getByRole('combobox',{name:'Theme',exact:true});await themePicker.click();await expect(page.getByRole('listbox')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(themePicker).toBeFocused();
 const save=page.getByRole('button',{name:'Save settings'});await save.click();await expect(page.getByRole('status')).toContainText('Local preview only');
 const confirm=page.getByRole('textbox',{name:'Confirm permanent account deletion'}),del=page.getByRole('button',{name:'Delete account permanently'});await expect(del).toBeDisabled();await confirm.fill('DELETE MY ACCOUNT');await expect(del).toBeEnabled();await confirm.fill('');await expect(del).toBeDisabled();await expect(page.getByRole('link',{name:'Download my data'})).toHaveAttribute('href','/api/account/export');
 }else if(surface==='support'){
 await page.getByRole('textbox',{name:'Subject',exact:true}).fill('Synthetic request');await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic support request with sufficient detail.');await page.getByRole('button',{name:'Create ticket',exact:true}).click();await expect(page.getByRole('status')).toContainText('Local preview only');
 await page.locator('.support-ticket-row').click();await expect(page.locator('.support-thread')).toContainText('Synthetic reply');await page.getByRole('textbox',{name:'Reply to support ticket'}).fill('Local reply');await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect(page.locator('.support-thread')).toContainText('Local reply');await expect(page.getByRole('textbox',{name:'Reply to support ticket'})).toBeEmpty();
 }else{
 const tables=page.locator('.table-wrap[role=region]');await expect(tables).toHaveCount(5);await expect(page.getByRole('region',{name:'Final billing receipts',exact:true})).toContainText('12.3456 Credits');await expect(page.getByRole('region',{name:'Wallet ledger'})).toContainText('-12.3456 Credits');await expect(page.getByRole('region',{name:'Wallet ledger'})).toContainText('87.6544 Credits');await expect(page.getByRole('region',{name:'Server-generated quotes and reservations'})).toContainText('Billing pending');
 for(const region of await tables.all()){await region.scrollIntoViewIfNeeded();await region.focus();await expect(region).toBeFocused();const dimensions=await region.evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth}));if(dimensions.scroll>dimensions.width+1){await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0)}}
 }
 if(info.project.use.viewport!.width<=620){for(const input of await root.locator('input:not([type=checkbox]),textarea').all())expect(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)}
 expect(api).toEqual([]);expect(errors).toEqual([]);
});
