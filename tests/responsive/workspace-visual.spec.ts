import {test,expect} from './safety';
if(process.env.PW_WORKSPACE_VISUAL==='1')for(const theme of ['light','dark'])for(const surface of ['history','files','battle'])test(`approved workspace visual ${surface} ${theme}`,async({page,context})=>{
 const api:string[]=[],errors:string[]=[];await context.route('**/api/**',async r=>{api.push(r.request().url());await r.abort()});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);await page.goto(`/responsive-fixture?surface=${surface}`,{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('data-workspace-data-ready',surface);
 await expect(page).toHaveScreenshot(`phase5-${surface}-${theme}.png`,{animations:'disabled',stylePath:'tests/responsive/screenshot.css',maxDiffPixelRatio:.01});expect(api).toEqual([]);expect(errors).toEqual([]);
});
