import {test as safeTest,expect} from './safety';
import type {Page} from '@playwright/test';
const test=safeTest.extend<{navigationDiagnostics:void}>({navigationDiagnostics:[async({page,context},use)=>{
 const errors:string[]=[],apis:string[]=[];
 const attach=(view:Page)=>{view.on('pageerror',e=>errors.push(e.message));view.on('console',m=>{if(m.type()==='error')errors.push(m.text())})};attach(page);context.on('page',attach);
 context.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url())});
 await use();expect(errors,'runtime/console errors').toEqual([]);expect(apis,'presentation fixtures never access APIs').toEqual([]);
},{auto:true}]});
async function open(page:Page,theme='light'){
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
 await page.goto('/responsive-fixture?navigation=demo',{waitUntil:'networkidle'});
 await expect(page.locator('.responsive-fixture')).toHaveAttribute('data-ready','true');
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
}
async function fits(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const widths=await page.locator('.app-main,.app-content').evaluateAll(els=>els.map(el=>({width:el.clientWidth,scroll:el.scrollWidth})));
 for(const item of widths)expect(item.scroll).toBeLessThanOrEqual(item.width+1);
}
for(const theme of ['light','dark'])test(`mobile navigation ${theme}: compact row, controls, project and account`,async({page},info)=>{
 await open(page,theme);const width=page.viewportSize()!.width;
 const header=page.locator('.workspace-topbar');const project=page.locator('.global-project');
 await project.click();await page.getByRole('button',{name:/Research project with/}).click();await expect(project).toHaveAttribute('title',/Research project/);
 await fits(page);expect(await project.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await project.click();await page.getByRole('button',{name:'56 Persistent project context'}).click();await expect(project).toHaveAttribute('aria-label','Active project: 56');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('amh-active-project'))).toBe('project-56');
 const search=page.locator('.command-trigger');await search.click();const palette=page.getByRole('dialog',{name:'Command palette'});
 await palette.getByRole('textbox',{name:'Search workspace'}).fill('Wallet');await expect(palette.getByRole('link',{name:/Wallet/})).toHaveAttribute('href','/wallet');await page.keyboard.press('Escape');await expect(search).toBeFocused();
 await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).click();await expect(page.getByText('Synthetic unread notification')).toBeVisible();await page.keyboard.press('Escape');
 await expect(header.getByRole('link',{name:/1234.50 credits available/})).toHaveAttribute('href','/wallet');
 if(width<=600){
  expect(await header.evaluate(el=>el.getBoundingClientRect().height)).toBe(56);
  const controls=header.locator('.global-project,.command-trigger,.topbar-icon-trigger,.wallet-chip,.mobile-profile-trigger');
  await page.mouse.move(0,page.viewportSize()!.height/2);
  await expect.poll(()=>controls.evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().y)))).toEqual([6,6,6,6,6]);
  const boxes=await controls.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right}}));
  for(let i=0;i<boxes.length;i++){expect(boxes[i].width).toBeGreaterThanOrEqual(44);expect(boxes[i].height).toBeGreaterThanOrEqual(44);expect(boxes[i].right).toBeLessThanOrEqual(width);expect(boxes[i].y).toBe(boxes[0].y);if(i)expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i-1].right);}
  await expect(search.locator('span')).toBeHidden();await expect(header.locator('.generation-trigger')).toBeHidden();
  const avatar=page.getByRole('button',{name:'Open mobile account menu'});await avatar.click();const account=page.getByRole('dialog',{name:'Account',exact:true});
  await expect(account.getByRole('link',{name:'Account & settings'})).toHaveAttribute('href','/settings');await expect(account.getByRole('button',{name:'Sign out'})).toBeVisible();
  await account.locator('.theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');await account.locator('.theme-toggle').click();
  for(const [key,label]of [['Control+k','Command palette'],['Shift+Slash','Keyboard shortcuts']]){await page.keyboard.press(key);await expect(account).toHaveCount(0);const overlay=page.getByRole('dialog',{name:label,exact:true});await expect(overlay).toBeVisible();await page.keyboard.press('Escape');await expect(avatar).toBeFocused();await avatar.click();}
  for(let i=0;i<8;i++)await page.keyboard.press('Tab');expect(await account.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(avatar).toBeFocused();
  await avatar.click();await page.locator('.workspace-mobile-account-backdrop').click({position:{x:2,y:2}});await expect(account).toHaveCount(0);await expect(avatar).toBeFocused();
  await page.reload({waitUntil:'networkidle'});await expect(project).toHaveAttribute('aria-label','Active project: 56');
 }else{
  await expect(header.locator('.theme-toggle')).toBeVisible();await expect(header.getByRole('link',{name:'Open account settings'})).toBeVisible();
  await expect(header.locator('.mobile-profile-trigger')).toBeHidden();if(width<=1180)expect(await header.evaluate(el=>el.getBoundingClientRect().height)).toBe(108);
 }
 await fits(page);await info.attach(`navigation-${theme}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
});
test('mobile navigation: grouped More, generation handoff, active destinations and focus',async({page},info)=>{
 await open(page);const width=page.viewportSize()!.width;
 if(width>900){await expect(page.locator('.mobile-nav')).toBeHidden();await page.getByRole('button',{name:'Open generation center'}).click();await expect(page.getByRole('dialog',{name:'Generation center',exact:true})).toBeVisible();await page.keyboard.press('Escape');return;}
 const nav=page.getByRole('navigation',{name:'Mobile workspace navigation'});await expect(nav.locator('a,button')).toHaveCount(5);
 for(const [name,href]of [['Chat','/chat'],['Image','/images'],['Video','/video'],['Audio','/audio']]){const link=nav.getByRole('link',{name,exact:true});await expect(link).toHaveAttribute('href',href);await link.click();await expect(link).toHaveAttribute('aria-current','page');}
 await page.emulateMedia({reducedMotion:'no-preference'});
 const more=page.getByRole('button',{name:'Open more navigation'});await more.click();const sheet=page.getByRole('dialog',{name:'Workspace navigation',exact:true});
 await expect(sheet).toHaveCSS('animation-name','mobile-sheet-in');
 for(const label of ['Workspace','Explore','Activity and Account'])await expect(sheet.getByRole('region',{name:label,exact:true})).toBeAttached();
 await expect(sheet.getByRole('link',{name:'Admin',exact:true})).toHaveCount(0);
 for(const label of ['Projects','Library','Files','Models','Compare','Templates','Wallet','Usage & Receipts','Notifications','Settings','Help & Support'])await expect(sheet.getByRole('link',{name:label,exact:true})).toBeAttached();
 const generation=sheet.getByRole('button',{name:/Generation Center/});await expect(generation).toContainText('1 in progress');await generation.scrollIntoViewIfNeeded();
 await info.attach('more-sheet',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 await generation.click();await expect(sheet).toHaveCount(0);const drawer=page.getByRole('dialog',{name:'Generation center',exact:true});await expect(drawer).toBeVisible();await expect(drawer.getByText('Synthetic chat activity')).toBeVisible();await expect(drawer.getByRole('link').filter({hasText:'Synthetic chat activity'})).toHaveAttribute('href','/chat?conversation=sample-conversation');
 await page.keyboard.press('Escape');await expect(more).toBeFocused();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 for(const [key,label]of [['Control+k','Command palette'],['Shift+Slash','Keyboard shortcuts']]){await more.click();await page.keyboard.press(key);await expect(sheet).toHaveCount(0);const overlay=page.getByRole('dialog',{name:label,exact:true});await expect(overlay).toBeVisible();await page.keyboard.press('Escape');await expect(more).toBeFocused();}
 await more.click();await sheet.getByRole('link',{name:'Settings',exact:true}).click();await expect(sheet).toHaveCount(0);await expect(more).toHaveClass(/active/);
 await more.click();await expect(sheet.getByRole('link',{name:'Settings',exact:true})).toHaveAttribute('aria-current','page');
 for(let i=0;i<25;i++)await page.keyboard.press('Tab');expect(await sheet.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await sheet.getByRole('button',{name:'Close navigation'}).click();await expect(more).toBeFocused();await page.emulateMedia({reducedMotion:'reduce'});await more.click();await expect(sheet).toHaveCSS('animation-name','none');await page.locator('.nav-backdrop').click({position:{x:2,y:2}});await expect(sheet).toHaveCount(0);await fits(page);
});
test('mobile navigation: real presentation surfaces preserve content and clearance',async({context},info)=>{
 test.setTimeout(180000);
 for(const theme of ['light','dark'])for(const [name,query]of [['chat','chat=welcome'],['image','studio=image'],['video','studio=video'],['audio','studio=audio'],['projects','surface=projects'],['library','surface=history'],['wallet','surface=wallet'],['settings','surface=settings']]){
  const page=await context.newPage();
  await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto('/responsive-fixture?'+query,{waitUntil:'networkidle'});
  await expect(page.locator('.workspace-topbar')).toHaveAttribute('data-workspace-ready','true');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await fits(page);
  await expect(page.locator('.command-trigger')).toBeInViewport();
  if(page.viewportSize()!.width<=600)expect(await page.locator('.workspace-topbar').evaluate(el=>el.getBoundingClientRect().height)).toBe(56);
  if(name==='chat')expect(await page.locator('.composer-wrap').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(await page.locator('.mobile-nav').evaluate(el=>el.getClientRects().length?el.getBoundingClientRect().top:innerHeight));
  await info.attach(`${name}-${theme}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});await page.close();
 }
});
