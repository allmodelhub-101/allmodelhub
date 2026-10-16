import { test, expect } from './safety';
import type { Page } from '@playwright/test';
async function openShell(page:Page, url='/responsive-fixture'){
  await page.goto(url,{waitUntil:'networkidle'});
  await expect(page.locator('.responsive-fixture')).toHaveAttribute('data-ready','true');
}

for (const theme of ['light','dark']) {
  test(`synthetic shell ${theme}: chrome, overflow, touch targets, screenshots`, async ({page},info) => {
    await page.addInitScript(value => localStorage.setItem('amh-theme',value),theme);
    const failures:string[]=[];
    page.on('pageerror',error=>failures.push(error.message));
    page.on('console',message=>{if(message.type()==='error') failures.push(message.text());});
    const apis:string[]=[]; page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/')) apis.push(request.url());});
    await openShell(page);
    await expect(page.getByRole('heading',{name:'Workspace foundation'})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    const width=page.viewportSize()!.width;
    const mobile=page.getByRole('navigation',{name:'Mobile workspace navigation'});
    const sidebar=page.getByRole('complementary',{name:'Workspace navigation'});
    if(width<=900) { await expect(mobile).toBeVisible(); await expect(sidebar).toBeHidden(); await expect(mobile.locator('a,button')).toHaveCount(5); }
    else { await expect(sidebar).toBeVisible(); await expect(mobile).toBeHidden(); }
    for(const control of ['Open generation center','Notifications','Open account settings']) await expect(page.getByRole(control==='Open account settings'?'link':'button',{name:control,exact:true})).toBeInViewport();
    await expect(page.locator('.app-topbar .theme-toggle')).toBeVisible();
    await expect(page.locator('.command-trigger')).toBeInViewport();
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,chrome:[...document.querySelectorAll('.app-topbar button,.app-topbar a,.mobile-nav a,.mobile-nav button')].filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute('aria-label')||e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
    expect(geometry.scroll).toBeLessThanOrEqual(width+1);
    for(const control of geometry.chrome) { expect(control.left,control.name||'control').toBeGreaterThanOrEqual(0); expect(control.right,control.name||'control').toBeLessThanOrEqual(width+1); if(width<=1180){expect(control.height,control.name||'control').toBeGreaterThanOrEqual(44);expect(control.width,control.name||'control').toBeGreaterThanOrEqual(44);} }
    const shot=info.outputPath(`shell-${theme}.png`);await page.screenshot({path:shot,animations:'disabled',caret:'hide',style:'nextjs-portal{visibility:hidden}'});await info.attach(`shell-${theme}`,{path:shot,contentType:'image/png'});
    if(process.env.PW_SHARED_VISUAL==='1'&&[390,768,1366].includes(width)) await expect(page).toHaveScreenshot(`phase2-shell-${theme}.png`,{animations:'disabled',caret:'hide',stylePath:'tests/responsive/screenshot.css',maxDiffPixelRatio:0.01});
    await page.getByText('End of sample content.',{exact:false}).scrollIntoViewIfNeeded();
    await expect(page.getByText('End of sample content.',{exact:false})).toBeInViewport();
    expect(apis,'offline fixture must never access application APIs').toEqual([]);
    expect(failures).toEqual([]);
  });
}

test('workspace overlays trap focus, dismiss and restore scroll/focus',async({page})=>{
  await openShell(page);
  for(const [trigger,label] of [['Open generation center','Generation center'],['Notifications','Notifications'],['Search or jump to','Command palette']] as const){
    const button=trigger==='Search or jump to'?page.locator('.command-trigger'):page.getByRole('button',{name:trigger,exact:true});
    await button.click(); const dialog=page.getByRole('dialog',{name:label,exact:true}); await expect(dialog).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
    for(let i=0;i<20;i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
    await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  }
  const project=page.locator('.global-project'); await project.click(); await expect(page.getByRole('dialog',{name:'Select project'})).toBeVisible(); await page.keyboard.press('Escape');await expect(project).toBeFocused();
});

test('navigation drawer or desktop account keyboard and persistence',async({page})=>{
  await openShell(page);
  if(page.viewportSize()!.width<=900){
    const more=page.getByRole('button',{name:'Open more navigation'});await more.click();const dialog=page.getByRole('dialog',{name:'Workspace navigation'});await expect(dialog).toBeVisible();
    await dialog.getByRole('link',{name:'Help & Support'}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('link',{name:'Help & Support'})).toBeInViewport();
    for(let i=0;i<20;i++)await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');await expect(more).toBeFocused();await expect(more).toHaveAttribute('aria-expanded','false');
    await more.click(); await page.locator('.nav-backdrop').click({position:{x:5,y:5}});await expect(dialog).toHaveCount(0);
  }else{
    const collapse=page.getByRole('button',{name:'Collapse sidebar'});await collapse.click();await expect(page.getByRole('button',{name:'Expand sidebar'})).toHaveAttribute('aria-expanded','false');
    await page.reload({waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'Expand sidebar'})).toBeVisible();
    const account=page.getByRole('button',{name:'Open account menu'});await account.click();await expect(page.getByRole('menu',{name:'Account'})).toBeVisible();await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Sign out'})).toBeFocused();await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:'Usage & Receipts'})).toBeFocused();await page.keyboard.press('Escape');await expect(account).toBeFocused();
  }
});

test('document model shortcut owns Ctrl K; nested overlay closes only topmost',async({page})=>{
  await openShell(page);
  await page.locator('.command-trigger').click(); const palette=page.getByRole('dialog',{name:'Command palette'});await expect(palette).toBeVisible();
  await page.keyboard.press('Control+k');const picker=page.getByRole('dialog',{name:'Choose the right intelligence'});await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);await expect(palette).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');await expect(palette).toHaveCount(0);await expect(page.locator('.command-trigger')).toBeFocused();
  await page.keyboard.press('Control+k');await expect(picker).toBeVisible();await expect(palette).toHaveCount(0);await page.keyboard.press('Escape');
});

test('shared selector and languages, keyboard-reduced viewport',async({page})=>{
  await openShell(page);
  const select=page.getByRole('combobox',{name:'Navigation language'});await select.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(select).toContainText('Roman Urdu');
  await select.focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await expect(select).toContainText('Urdu');
  await expect(page.locator('.responsive-fixture')).toHaveAttribute('dir','rtl');
  const size=page.viewportSize()!;await page.setViewportSize({width:size.width,height:Math.max(280,size.height-300)});const input=page.getByPlaceholder('Write a local note');await input.fill('Local note');await input.scrollIntoViewIfNeeded();await expect(input).toBeFocused();await expect(input).toBeInViewport();
});

test('auth login and signup theme switches persist in both directions',async({page})=>{
  for(const route of ['/auth/login','/auth/signup']){
    await page.goto(route,{waitUntil:'networkidle'});const toggle=page.locator('.auth-nav-actions .theme-toggle');await expect(toggle).toHaveAttribute('aria-label',/Switch to/);await expect(toggle).toBeVisible();
    await toggle.click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload({waitUntil:'networkidle'});await expect(toggle).toHaveAttribute('aria-label','Switch to light theme');await toggle.click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  }
});

test('shell fixture rejects non-loopback host',async({request})=>{
  const response=await request.get('/responsive-fixture',{headers:{host:'preview.example.invalid'}});
  expect(response.status()).toBe(404);
});

test('shared chrome also fits with legacy chat ancestor selectors',async({page})=>{
  await openShell(page,'/responsive-fixture?chrome=chat');
  await expect(page.locator('.app-topbar .theme-toggle')).toBeVisible();
  await expect(page.locator('.command-trigger')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open generation center'})).toBeVisible();
  const width=page.viewportSize()!.width;
  const geometry=await page.locator('.app-topbar').evaluate(el=>({height:el.getBoundingClientRect().height,controls:[...el.querySelectorAll('a,button')].filter(e=>e.getClientRects().length).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height}))}));
  if(width<=1180) expect(geometry.height).toBe(108);
  for(const control of geometry.controls){expect(control.left).toBeGreaterThanOrEqual(0);expect(control.right).toBeLessThanOrEqual(width+1);if(width<=1180)expect(control.height).toBeGreaterThanOrEqual(44);}
});

test('real navigation links expose selected destination using synthetic route state',async({page})=>{
  await openShell(page);
  const mobile=page.viewportSize()!.width<=900;
  const navigation=mobile?page.getByRole('navigation',{name:'Mobile workspace navigation'}):page.getByRole('navigation',{name:'Workspace pages'});
  await expect(navigation.getByRole('link',{name:'Chat',exact:true})).toHaveAttribute('aria-current','page');
  const image=navigation.getByRole('link',{name:'Image',exact:true});await expect(image).toHaveAttribute('href','/images');await image.click();await expect(image).toHaveAttribute('aria-current','page');
  await expect(navigation.getByRole('link',{name:'Chat',exact:true})).not.toHaveAttribute('aria-current','page');
  if(mobile){await page.getByRole('button',{name:'Open more navigation'}).click();const dialog=page.getByRole('dialog',{name:'Workspace navigation'});await dialog.getByRole('link',{name:'Settings',exact:true}).click();await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Open more navigation'}).click();await expect(page.getByRole('dialog',{name:'Workspace navigation'}).getByRole('link',{name:'Settings',exact:true})).toHaveAttribute('aria-current','page');}
  await expect(page).toHaveURL(/\/responsive-fixture$/); // selection is synthetic; protected navigation is not bypassed.
});
