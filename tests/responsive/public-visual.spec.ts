import {test,expect} from './safety';
if(process.env.PW_PHASE5_PUBLIC_VISUAL==='1')for(const theme of ['light','dark'])for(const [name,path]of [['login','/auth/login'],['legal','/privacy']])test(`approved phase5 public ${name} ${theme}`,async({page})=>{
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto(path,{waitUntil:'networkidle'});await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/);await expect(page).toHaveScreenshot(`phase5-public-${name}-${theme}.png`,{animations:'disabled',stylePath:'tests/responsive/screenshot.css',maxDiffPixelRatio:.01});
});
