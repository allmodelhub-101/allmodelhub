import {test as safeTest,expect} from './safety';
import type {Page} from '@playwright/test';
const test=safeTest.extend<{studioDiagnostics:void}>({studioDiagnostics:[async({page},use)=>{const errors:string[]=[],apis:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});await use();expect(errors).toEqual([]);expect(apis,'local studio must not contact application APIs').toEqual([])},{auto:true}]});
async function open(page:Page,studio:string,state='idle',theme='light'){
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto(`/responsive-fixture?studio=${studio}&state=${state}`,{waitUntil:'networkidle'});
 await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)}
for(const theme of ['light','dark'])test(`image ${theme}: prompt, settings, model and local references`,async({page},info)=>{
 await open(page,'image','idle',theme);await expect(page.getByRole('heading',{name:'Create an image'})).toBeVisible();const input=page.getByRole('textbox',{name:'Image prompt'});await input.fill('A thoughtful composition\n'.repeat(12));await input.scrollIntoViewIfNeeded();await expect(input).toBeInViewport();
 const model=page.locator('.model-tool');await model.click();const dialog=page.getByRole('dialog',{name:'Choose an image model'});await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(model).toBeFocused();
 const settings=page.locator('.settings-tool');await settings.click();await page.getByRole('button',{name:/9:16 Portrait/}).click();await expect(page.getByRole('button',{name:/9:16 Portrait/})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(settings).toBeFocused();
 await page.locator('input[type=file]').setInputFiles({name:'synthetic-long-reference-name_'.repeat(6)+'.png',mimeType:'image/png',buffer:Buffer.from('local synthetic metadata')});await expect(page.locator('.image-reference-chip')).toHaveCount(1);await page.getByRole('button',{name:/Remove synthetic/}).click();await expect(page.locator('.image-reference-chip')).toHaveCount(0);await fits(page);
 if([390,768,1366].includes(page.viewportSize()!.width)){const path=info.outputPath(`image-${theme}.png`);await page.screenshot({path,fullPage:true,animations:'disabled'});await info.attach(`image-${theme}`,{path,contentType:'image/png'})}
});
test('image result viewer and queued/failure states',async({page})=>{
 await open(page,'image','completed');const trigger=page.getByRole('button',{name:'View full image'});await trigger.click();const dialog=page.getByRole('dialog',{name:'Image viewer'});await expect(dialog).toBeVisible();const img=dialog.locator('img');expect(await img.evaluate(el=>getComputedStyle(el).objectFit)).toBe('contain');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await fits(page);
 await open(page,'image','queued');await expect(page.getByRole('heading',{name:'Your request is in line'})).toBeVisible();await open(page,'image','error');await page.getByRole('button',{name:'Try again'}).click();await expect(page.getByRole('textbox',{name:'Image prompt'})).toBeVisible();
});
