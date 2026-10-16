import {test,expect} from './safety';
// Generate with --update-snapshots, review images, then run without that flag.
for(const [name,route] of [['login','/auth/login'],['legal','/privacy'],['video-fixture','/studio-fixture']]) {
  test(`visual baseline ${name}`,async({page})=>{
    test.skip(!process.env.PW_VISUAL,'Opt-in: PW_VISUAL=1; baselines are OS/browser/viewport specific.');
    await page.goto(route,{waitUntil:'networkidle'});
    await expect(page.locator('h1').first()).toBeVisible();
    if(name==='video-fixture') {
      // Confirm hydration through local fixture state, then restore the empty initial view.
      const prompt=page.getByRole('textbox',{name:'Scene direction'});
      await expect(async()=>{
        await prompt.fill('baseline');
        await expect(page.getByText('8 / 20,000',{exact:true})).toBeVisible({timeout:1000});
      }).toPass({timeout:15_000});
      await prompt.fill('');
      await expect(page.getByText('0 / 20,000',{exact:true})).toBeVisible();
      await prompt.blur();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    } else {
      await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
    }
    await page.evaluate(()=>document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name==='video-fixture'?name:`phase2-${name}`}.png`,{animations:'disabled',caret:'initial',stylePath:'tests/responsive/screenshot.css',maxDiffPixelRatio:0.01});
  });
}
