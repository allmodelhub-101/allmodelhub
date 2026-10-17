import AxeBuilder from '@axe-core/playwright';
import {test,expect} from './safety';
const scenes=[['homepage','/'],...['battle','templates','notifications'].map(s=>[s,`/responsive-fixture?surface=${s}`]),['login','/auth/login'],['legal','/privacy'],['chat','/responsive-fixture?chat=long'],...['history','projects','models','files','settings','support','usage','wallet','admin'].map(s=>[s,`/responsive-fixture?surface=${s}&state=populated`]),...['image','video','audio'].map(s=>[s,`/responsive-fixture?studio=${s}&state=completed`])];
for(const theme of ['light','dark'])for(const [name,path]of scenes)test(`hardening WCAG ${name} ${theme}`,async({page},info)=>{
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
 await page.goto(path,{waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 if(name!=='admin')await expect(page.locator('.theme-toggle').first()).toHaveAttribute('aria-label',theme==='light'?'Switch to dark theme':'Switch to light theme');
 await page.evaluate(()=>document.fonts.ready);
 // Flush theme style/layout and paint before discovering finite transitions.
 // WebKit can defer this work until axe's first style read; sampling midway
 // through a theme transition mixes old foreground and new panel colors.
 await page.evaluate(()=>{document.body.getBoundingClientRect();getComputedStyle(document.body).getPropertyValue("color");return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))});
 await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a instanceof CSSTransition).map(a=>a.finished.catch(()=>{})))});
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 if(result.violations.length){
  await info.attach('rendered-color-evidence',{body:JSON.stringify(await page.evaluate(targets=>({theme:document.documentElement.dataset.theme,body:getComputedStyle(document.body).color,nodes:targets.map(selector=>{const el=document.querySelector(selector);return {selector,color:el&&getComputedStyle(el).color,background:el&&getComputedStyle(el).backgroundColor}})}),result.violations.flatMap(v=>v.nodes.flatMap(n=>n.target.filter((t):t is string=>typeof t==='string'))))),contentType:'application/json'});
  await info.attach('rendered-accessibility-failure',{body:await page.screenshot(),contentType:'image/png'});
 }
 await info.attach('accessibility-summary',{body:JSON.stringify({path,theme,violations:result.violations,incomplete:result.incomplete.map(r=>({id:r.id,count:r.nodes.length})),passes:result.passes.length}),contentType:'application/json'});
 expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),'automated WCAG subset; incomplete checks still need manual review').toEqual([]);
});
