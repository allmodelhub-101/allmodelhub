import AxeBuilder from '@axe-core/playwright';
import {test,expect} from './safety';
const scenes=[['homepage','/'],...['battle','templates','notifications'].map(s=>[s,`/responsive-fixture?surface=${s}`]),['login','/auth/login'],['signup','/auth/signup'],['password-recovery','/auth/update-password'],['legal','/privacy'],...['terms','refunds','acceptable-use'].map(s=>[s,`/${s}`]),['chat','/responsive-fixture?chat=long'],...['history','projects','models','files','settings','support','usage','wallet','admin'].map(s=>[s,`/responsive-fixture?surface=${s}&state=populated`]),...['image','video','audio'].map(s=>[s,`/responsive-fixture?studio=${s}&state=completed`])];
for(const theme of ['light','dark'])for(const [name,path]of scenes)test(`hardening WCAG ${name} ${theme}`,async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
 await page.goto(path,{waitUntil:'networkidle'});
 await expect(page.getByRole('main'),'each rendered page has one main landmark').toHaveCount(1);
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 if(name!=='admin')await expect(page.locator('.theme-toggle').first()).toHaveAttribute('aria-label',theme==='light'?'Switch to dark theme':'Switch to light theme');
 await page.evaluate(()=>document.fonts.ready);
 // Capture the complete render, including proof labels below the initial fold.
 const rendered=await page.screenshot({fullPage:true});
 if(name==='homepage'){
  for(const label of await page.locator('#cin-hero-title,#cin-faq-title,.cin-proof strong').all())
   await expect(label).toHaveCSS('color',theme==='light'?'rgb(11, 18, 32)':'rgb(245, 248, 251)');
  await info.attach('homepage-theme-render',{body:rendered,contentType:'image/png'});
 }
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 if(result.violations.length){
  await info.attach('rendered-color-evidence',{body:JSON.stringify(await page.evaluate(targets=>({theme:document.documentElement.dataset.theme,body:getComputedStyle(document.body).color,nodes:targets.map(selector=>{const el=document.querySelector(selector);return {selector,color:el&&getComputedStyle(el).color,background:el&&getComputedStyle(el).backgroundColor,fill:el&&getComputedStyle(el).webkitTextFillColor}})}),result.violations.flatMap(v=>v.nodes.flatMap(n=>n.target.filter((t):t is string=>typeof t==='string'))))),contentType:'application/json'});
  await info.attach('rendered-accessibility-before-scan',{body:rendered,contentType:'image/png'});
  await info.attach('rendered-accessibility-failure',{body:await page.screenshot(),contentType:'image/png'});
 }
 await info.attach('accessibility-summary',{body:JSON.stringify({path,theme,violations:result.violations,incomplete:result.incomplete.map(r=>({id:r.id,count:r.nodes.length})),passes:result.passes.length}),contentType:'application/json'});
 expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),'automated WCAG subset; incomplete checks still need manual review').toEqual([]);
});
