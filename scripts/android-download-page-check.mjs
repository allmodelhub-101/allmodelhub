import { chromium, webkit, devices, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.ANDROID_PAGE_BASE || 'http://localhost:3107';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Page-only checks must use a local server.');
const out = 'docs/android/premium-page';
await fs.mkdir(`${out}/screenshots`,{recursive:true});
const results = [];
const errors = [];
const android = devices['Pixel 7'].userAgent;
const remaining = process.env.ANDROID_PAGE_CHECK_FOCUS === 'remaining';

for (const [engine, type, widths] of [['chromium',chromium,[320,390,430,768,1366]], ['webkit',webkit,[390]]]) {
  const browser = await type.launch();
  try {
    for (const width of (remaining && engine === 'chromium' ? [] : widths)) for (const theme of ['light','dark']) {
      const height = width === 320 ? 568 : width < 600 ? 844 : 900;
      const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,userAgent:width<600?android:undefined,hasTouch:width<600,isMobile:width<600});
      await context.addInitScript(value=>localStorage.setItem('amh-theme',value),theme);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      console.log(`Checking ${engine} ${width} ${theme}`);
      page.on('pageerror',error=>errors.push(`${engine}/${width}/${theme}: ${error.message}`));
      await page.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:theme==='dark'?'Switch to light theme':'Switch to dark theme'}).waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('h1')].every(e=>getComputedStyle(e).opacity==='1'),null,{polling:100,timeout:5000});
      const geometry = await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,inner:innerWidth,button:document.querySelector('[data-install-environment] a')?.getBoundingClientRect().toJSON()}));
      assert.equal(geometry.scroll, width,`${engine}/${width}/${theme}: document overflow`);
      assert.equal(geometry.inner,width,`${engine}/${width}/${theme}: mobile auto-zoom`);
      if(width<600) assert.ok(geometry.button.bottom < height,`Primary install action is below the fold: ${geometry.button.bottom}`);
      assert.equal(await page.getByRole('link',{name:/Download.*APK|Signed APK.*v/}).count(),0);
      await expect(page.getByText('Coming soon',{exact:true})).toBeVisible();
      const tabs=page.getByRole('tab');
      for(const name of ['Chat','Image','Video','Audio']) {
        await page.getByRole('tab',{name,exact:true}).click();
        await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
        const image=page.getByRole('tabpanel').locator('img:visible');
        await expect(image).toHaveAttribute('alt',new RegExp(`Models Suite ${name} workspace`));
        await image.evaluate(async element=>{
          element.loading='eager';
          await Promise.race([element.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Selected preview did not load')),10000))]);
        });
      }
      await tabs.last().focus(); await page.keyboard.press('Home');
      await expect(tabs.first()).toBeFocused();
      await page.keyboard.press('ArrowRight'); await expect(tabs.nth(1)).toBeFocused();
      await page.keyboard.press('Home');
      // Eager-load only this page's real preview assets for complete captures.
      // Smooth scrolling must not leave below-fold lazy-image decodes pending.
      await page.locator('img:visible').evaluateAll(async elements=>{
        for(const image of elements) image.loading='eager';
        await Promise.race([Promise.all(elements.map(e=>e.decode().catch(()=>{}))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Preview image decode timed out')),15000))]);
      });
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:`${out}/screenshots/${engine}-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
      if(width===320||width===390) {
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await page.waitForFunction(()=>scrollY===0);
        await page.screenshot({path:`${out}/screenshots/${engine}-${width}-${theme}-hero.png`,animations:'disabled'});
      }
      if(engine==='chromium'&&width===390) {
        const scan=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
      }
      results.push({engine,width,height,theme,geometry,tabs:'PASS',unpublishedApkHidden:true,axe:engine==='chromium'&&width===390?'PASS':'not repeated'});
      await context.close();
    }

    if(engine==='chromium') {
      const context=await browser.newContext({viewport:{width:390,height:844},userAgent:android});
      const page=await context.newPage();
      await page.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Switch to dark theme',exact:true}).waitFor();
      await page.evaluate(()=>{window.__androidPromptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});Object.assign(event,{prompt:async()=>{window.__androidPromptCalls++},userChoice:Promise.resolve({outcome:'accepted'})});window.dispatchEvent(event);});
      await page.getByRole('button',{name:'Install from Chrome',exact:true}).click();
      await expect(page.getByRole('status')).toContainText('Installation accepted');
      assert.equal(await page.evaluate(()=>window.__androidPromptCalls),1);
      results.push({check:'Android Chrome one-shot install event',status:'PASS',scope:'Synthetic browser event; not OS installation'});
      const showcase=page.locator('[data-moving]');
      await showcase.scrollIntoViewIfNeeded();
      await expect(showcase).toHaveAttribute('data-moving','true');
      assert.ok(await showcase.evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.playState==='running')));
      await page.evaluate(()=>document.querySelector('#install-guide').scrollIntoView({behavior:'instant'}));
      await expect(showcase).toHaveAttribute('data-moving','false');
      results.push({check:'Normal showcase motion runs visibly and pauses offscreen',status:'PASS'});
      await context.close();

      const desktop=await browser.newPage(); await desktop.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      await expect(desktop.getByRole('status')).toContainText('Android device required');
      await desktop.goto(base,{waitUntil:'domcontentloaded'});
      await expect(desktop.getByRole('link',{name:'Get Android App',exact:true})).toBeVisible();
      results.push({check:'Unsupported-device guidance and homepage entry',status:'PASS'});
      await desktop.close();

      const installed=await browser.newContext();
      await installed.addInitScript(()=>{const original=matchMedia.bind(window);window.matchMedia=query=>{const media=original(query);if(query==='(display-mode: standalone)')return{matches:true,addEventListener(){},removeEventListener(){},media:query};return media;};});
      const installedPage=await installed.newPage(); await installedPage.goto(base,{waitUntil:'domcontentloaded'});
      await expect(installedPage.getByRole('link',{name:'Get Android App',exact:true})).toHaveCount(0);
      await installedPage.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      await expect(installedPage.getByRole('link',{name:'Open Models Suite',exact:true})).toBeVisible();
      assert.equal(await installedPage.getByRole('button',{name:'Install from Chrome',exact:true}).count(),0);
      results.push({check:'Standalone suppresses promotion and switches to open-workspace action',status:'PASS'});
      await installed.close();

      const alternate=await browser.newPage({userAgent:android+' SamsungBrowser/28.0'});
      await alternate.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      await expect(alternate.getByRole('status')).toContainText('open this page in Chrome on Android');
      await expect(alternate.getByRole('link',{name:'Chrome install guide',exact:true})).toBeVisible();
      await alternate.close();
      results.push({check:'Other Android browser has explicit Chrome guidance',status:'PASS'});

      const reduced=await browser.newPage({reducedMotion:'reduce'});
      await reduced.goto(`${base}/android`,{waitUntil:'domcontentloaded'});
      assert.equal(await reduced.locator('[data-moving]').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
      await reduced.close();
      results.push({check:'Reduced motion disables showcase animations',status:'PASS'});
    }
  } finally {await browser.close();}
}
assert.deepEqual(errors,[]);
await fs.writeFile(`${out}/${remaining?'remaining-results':'page-results'}.json`,JSON.stringify({status:'PASS',base,scope:remaining?'Control checks and WebKit only; combine with a separately retained Chromium layout run':'Full page-only checks',results,errors},null,2)+'\n');
console.log(`${results.length} focused page checks passed; screenshots in ${out}/screenshots/.`);
