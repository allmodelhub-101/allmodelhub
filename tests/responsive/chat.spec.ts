import {test as safeTest,expect} from './safety';
const test=safeTest.extend<{chatDiagnostics:void}>({chatDiagnostics:[async({page},use)=>{
 const errors:string[]=[],apis:string[]=[],resources:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});page.on('response',r=>{if(r.status()>=400)resources.push(`${r.status()} ${new URL(r.url()).pathname}`)});
 await use();expect(errors,'runtime/hydration errors').toEqual([]);expect(apis,'synthetic Chat must not access application APIs').toEqual([]);expect(resources,'failed resources').toEqual([]);
 },{auto:true}]});
import type {Page,TestInfo} from '@playwright/test';
async function openChat(page:Page,state='welcome',theme='light'){
 await page.addInitScript(theme=>localStorage.setItem('amh-theme',theme),theme);
 await page.goto(`/responsive-fixture?chat=${state}`,{waitUntil:'networkidle'});
 await expect(page.locator('.chat-workspace')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
}
async function compactDraftBudget(page:Page,info:TestInfo,state:string){
 const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill(Array(12).fill('A long draft in a short viewport').join('\n'));
 const budget=await page.evaluate(()=>{const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect(),nav=document.querySelector('.mobile-nav')!;return {bottom:rect('.composer-wrap').bottom,navTop:nav.getClientRects().length?rect('.mobile-nav').top:innerHeight,history:rect('.chat-layout-body').height}});
 expect(budget.bottom,'expanded composer stays above navigation').toBeLessThanOrEqual(budget.navTop+1);expect(budget.history,'history remains reachable above expanded drafts and secondary content').toBeGreaterThanOrEqual(24);
 await expect(input).toBeInViewport();await expect(page.getByRole('button',{name:'Send message'})).toBeInViewport();
 if([320,844].includes(page.viewportSize()!.width)&&page.viewportSize()!.height===390){const path=info.outputPath(`expanded-${state}.png`);await page.screenshot({path,animations:'disabled',style:'nextjs-portal{visibility:hidden}'});await info.attach(`expanded-${state}`,{path,contentType:'image/png'})}
}
for(const theme of ['light','dark'])test(`chat ${theme}: welcome, composer budget and real controls`,async({page},info)=>{
 const errors:string[]=[],apis:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
 await openChat(page,'welcome',theme);
 await expect(page.getByRole('heading',{name:/What will you/})).toBeVisible();
 const input=page.getByRole('textbox',{name:'Message',exact:true});await expect(input).toBeInViewport();
 const geometry=await page.evaluate(()=>{const r=(s:string)=>document.querySelector(s)!.getBoundingClientRect();const c=r('.composer'),h=r('.app-topbar'),b=r('.chat-layout-body'),nav=document.querySelector('.mobile-nav')!;return {scroll:document.documentElement.scrollWidth,width:innerWidth,composer:{top:c.top,bottom:c.bottom,height:c.height},header:h.bottom,bodyHeight:b.height,navTop:nav.getClientRects().length?r('.mobile-nav').top:innerHeight}});
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.composer.top).toBeGreaterThanOrEqual(geometry.header);expect(geometry.composer.bottom).toBeLessThanOrEqual(geometry.navTop+1);expect(geometry.bodyHeight).toBeGreaterThan(35);expect(geometry.composer.height).toBeLessThan(page.viewportSize()!.height*.45);
 for(const name of ['Attach files','Start voice typing','Send message','Chat controls: project, routing and privacy']){const button=page.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44)}
 await expect(page.getByRole('button',{name:/Choose AI model. Current selection/})).toBeInViewport();
 if(page.viewportSize()!.width<=430)expect((await page.locator('.composer-footer').boundingBox())!.height,'primary controls stay on one compact toolbar row').toBeLessThanOrEqual(48);
 if([390,768,1366].includes(page.viewportSize()!.width)){const path=info.outputPath(`chat-${theme}.png`);await page.screenshot({path,animations:'disabled',style:'nextjs-portal{visibility:hidden}'});await info.attach(`chat-${theme}`,{path,contentType:'image/png'});if(process.env.PW_CHAT_VISUAL==='1')await expect(page).toHaveScreenshot(`phase3-welcome-${theme}.png`,{animations:'disabled',stylePath:'tests/responsive/screenshot.css',maxDiffPixelRatio:.01})}
 expect(errors).toEqual([]);expect(apis).toEqual([]);
});

test('chat native editing, IME, textarea growth, context and local send',async({page})=>{
 await openChat(page);const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('First line');const short=(await input.boundingBox())!.height;
 await input.press('Shift+Enter');await input.type('Second line');await expect(input).toHaveValue('First line\nSecond line');
 await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,isComposing:true});await expect(input).toHaveValue('First line\nSecond line');
 await input.fill(Array(12).fill('A useful draft').join('\n'));expect((await input.boundingBox())!.height).toBeGreaterThan(short);expect((await input.boundingBox())!.height).toBeLessThanOrEqual(146);
 await input.fill('Analyze');
 await input.evaluate(el=>{const data=new DataTransfer();data.setData('text','synthetic context '.repeat(100));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))});
 await expect(page.getByText('Pasted text',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Remove pasted text'}).click();await expect(page.getByText('Pasted text',{exact:true})).toHaveCount(0);
 await input.fill('A short local question');await input.press('Enter');await expect(page.getByText('Local fixture response. No request was sent.',{exact:true})).toBeVisible();await expect(input).toHaveValue('');
});

test('chat model search, selection, availability and focus return',async({page})=>{
 await openChat(page);const trigger=page.getByRole('button',{name:/Choose AI model. Current selection/});await trigger.click();const dialog=page.getByRole('dialog',{name:'Choose the right intelligence'});await expect(dialog).toBeVisible();
 await page.getByPlaceholder('Model, provider, or capability').fill('unavailable');await expect(dialog.getByRole('button',{name:/Sample unavailable/})).toBeDisabled();
 await page.getByPlaceholder('Model, provider, or capability').fill('Sample fast');await dialog.getByRole('button',{name:/Sample fast/}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(trigger).toContainText('Sample fast');
 await trigger.click();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await page.keyboard.press('Control+k');await expect(dialog).toBeVisible();await expect(page.getByRole('dialog',{name:'Command palette'})).toHaveCount(0);await page.keyboard.press('Escape');
});

test('chat controls keep settings, project, privacy and enhancement reachable',async({page})=>{
 await openChat(page);await page.getByRole('textbox',{name:'Message',exact:true}).fill('A local draft');const trigger=page.getByRole('button',{name:'Chat controls: project, routing and privacy'});await trigger.click();const dialog=page.getByRole('dialog',{name:'Chat controls',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('combobox',{name:'Project',exact:true}).click();await dialog.getByRole('option',{name:/Sample research/}).click();await expect(dialog.getByRole('combobox',{name:'Project',exact:true})).toContainText('Sample research');
 const switches=dialog.getByRole('switch');await switches.nth(0).click();await expect(switches.nth(0)).toHaveAttribute('aria-checked','true');await switches.nth(1).click();await expect(switches.nth(1)).toHaveAttribute('aria-checked','true');
 for(let i=0;i<15;i++)await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(page.getByRole('status').filter({hasText:'Private chat'})).toBeVisible();
 await trigger.click();await dialog.getByRole('button',{name:'Improve prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Clarified local prompt: A local draft');
});

test('chat long Markdown is readable with local code/table scrolling',async({page},info)=>{
 await openChat(page,'long');const body=page.getByRole('region',{name:'Conversation',exact:true});await body.evaluate(el=>el.scrollTop=0);await expect(page.getByRole('button',{name:'Latest',exact:true})).toBeVisible();
 const code=page.getByRole('region',{name:'Code block',exact:true});await code.scrollIntoViewIfNeeded();await expect(code).toBeInViewport();
 const table=page.getByRole('region',{name:'Message table',exact:true});await table.scrollIntoViewIfNeeded();await expect(table).toBeInViewport();
 expect(await table.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await table.focus();await page.keyboard.press('ArrowRight');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const position=await body.evaluate(el=>el.scrollTop);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Keep reading');expect(Math.abs((await body.evaluate(el=>el.scrollTop))-position)).toBeLessThan(10);
 if([390,768,1366].includes(page.viewportSize()!.width)){const path=info.outputPath('long-content.png');await page.screenshot({path,animations:'disabled'});await info.attach('long-content',{path,contentType:'image/png'})}
 await page.getByRole('button',{name:'Latest',exact:true}).click();expect(await body.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(5);
 await body.evaluate(el=>el.scrollTop=0);await expect(page.getByRole('button',{name:'Latest',exact:true})).toBeVisible();const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('A new question while reading history');await input.press('Enter');await expect(page.getByText('Local fixture response. No request was sent.',{exact:true})).toBeVisible();expect(await body.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(5);
});

test('streaming-like updates respect readers and Stop remains usable',async({page})=>{
 await openChat(page,'streaming');const body=page.getByRole('region',{name:'Conversation',exact:true});await body.evaluate(el=>el.scrollTop=0);await expect(page.getByRole('button',{name:'Latest',exact:true})).toBeVisible();
 const original=await body.evaluate(el=>el.scrollTop);const text=page.locator('.chat-row.assistant').last();const length=(await text.textContent())!.length;await expect.poll(async()=>(await text.textContent())!.length).toBeGreaterThan(length);expect(Math.abs((await body.evaluate(el=>el.scrollTop))-original)).toBeLessThan(5);
 await page.getByRole('button',{name:'Stop generation'}).click();await expect(page.getByRole('button',{name:'Send message'})).toBeVisible();await expect(page.getByText('Response interrupted · Retry available',{exact:true})).toBeVisible();
});

test('attachments and long filenames stay contained; reduced height keeps composer reachable',async({page},info)=>{
 await openChat(page,'attachments');await expect(page.locator('.attachment-card')).toHaveCount(3);const remove=page.getByRole('button',{name:/Remove Research_notes_0_/});await remove.click();await expect(page.locator('.attachment-card')).toHaveCount(2);
 const size=page.viewportSize()!;await page.setViewportSize({width:size.width,height:Math.max(390,size.height-300)});const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('Typing with a reduced viewport');await expect(input).toBeInViewport();await expect(page.getByRole('button',{name:'Send message'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await compactDraftBudget(page,info,'attachments');
});

test('loading, pending billing, interrupted and error presentation',async({page},info)=>{
 await openChat(page,'loading');await expect(page.getByText('Understanding your request',{exact:true}).or(page.getByText('Sample model is responding',{exact:true}))).toBeVisible();await expect(page.getByRole('button',{name:'Stop generation'})).toBeInViewport();await page.getByRole('textbox',{name:'Message',exact:true}).focus();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Send message'})).toBeVisible();
 await openChat(page,'pending');await expect(page.getByText('Sample model · Billing pending',{exact:true})).toBeVisible();
 await openChat(page,'interrupted');await expect(page.getByText('Response interrupted · Retry available',{exact:true})).toBeVisible();
 await openChat(page,'error');await expect(page.getByRole('alert').filter({hasText:'Request not completed'})).toContainText('Synthetic connection failure');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('My preserved draft');
 const size=page.viewportSize()!;await page.setViewportSize({width:size.width,height:390});await compactDraftBudget(page,info,'error');
 const alert=page.getByRole('alert').filter({hasText:'Request not completed'});await alert.focus();await expect(alert).toBeFocused();await page.keyboard.press('ArrowDown');
});
test('chat discovery, message actions, local attachment selection and voice presentation',async({page})=>{
 await openChat(page);
 await page.emulateMedia({reducedMotion:'no-preference'});const track=page.locator('.popular-model-track');await expect(track).toHaveCSS('animation-name','chat-discovery-drift');const discovery=page.getByRole('navigation',{name:'Popular AI models'}).getByRole('button',{name:'Sample fast',exact:true});await discovery.focus();await expect(track).toHaveCSS('animation-play-state','paused');await discovery.click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:/Choose AI model. Current selection/})).toContainText('Sample fast');
 await page.locator('input[type=file]').setInputFiles({name:'local-layout-sample.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic local attachment only')});await expect(page.locator('.attachment-card')).toContainText('local-layout-sample.txt');
 await page.getByRole('button',{name:'Remove local-layout-sample.txt'}).click();await expect(page.locator('.attachment-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Start voice typing'}).click();await expect(page.getByRole('button',{name:'Stop voice typing'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Start voice typing'})).toBeVisible();
 await openChat(page,'conversation');await page.getByRole('button',{name:'Edit prompt'}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Help me understand this research.');
 await openChat(page,'conversation');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Request not completed'})).toContainText('Synthetic retry requested');
 await page.getByRole('button',{name:'Branch',exact:true}).click();await expect(page.locator('.chat-row')).toHaveCount(2);
});
