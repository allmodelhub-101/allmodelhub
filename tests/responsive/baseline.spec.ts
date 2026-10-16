import fs from 'node:fs';
import { test, expect } from './safety';
const inventory=JSON.parse(fs.readFileSync('docs/mobile-route-inventory.json','utf8')) as {pages:Array<{route:string;access:string}>};
const publicRoutes=inventory.pages.filter(p=>p.access==='public'||p.route==='/auth/update-password').map(p=>p.route);
for(const route of [...publicRoutes,'/studio-fixture']) {
  test(`${route} loads, controls, overflow and diagnostics`, async ({page}, info)=>{
    const errors:string[]=[], resources:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)resources.push(`${r.status()} ${new URL(r.url()).pathname}`);});
    page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')resources.push(`${r.failure()?.errorText} ${new URL(r.url()).pathname}`);});
    const response=await page.goto(route,{waitUntil:'networkidle'});
    await expect(page.locator('h1').first()).toBeVisible();
    if(route!=='/studio-fixture') await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
    if(route==='/') await expect(page.getByRole('link',{name:'Start Free',exact:true}).first()).toBeVisible();
    if(route==='/auth/login') await expect(page.getByRole('button',{name:'Sign in to workspace',exact:true})).toBeVisible();
    if(route==='/auth/signup') await expect(page.getByRole('button',{name:'Create my account',exact:true})).toBeVisible();
    if(route==='/studio-fixture') await expect(page.getByRole('button',{name:/Choose a video model:/})).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    const controls=await page.locator('a,button,input,textarea,select').evaluateAll(nodes=>nodes.filter(n=>{
      const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(n).visibility!=='hidden';
    }).map(n=>{const b=n.getBoundingClientRect();return {tag:n.tagName,label:n.getAttribute('aria-label')||n.textContent?.trim()||n.getAttribute('name'),width:b.width,height:b.height};}));
    const geometry=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,fontFamily:getComputedStyle(document.body).fontFamily,
      body:document.body.scrollWidth, offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,40).map(e=>({tag:e.tagName,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
    await info.attach('geometry-and-controls',{body:JSON.stringify({geometry,controls,errors,resources},null,2),contentType:'application/json'});
    await info.attach('responsive-viewport',{body:await page.screenshot({animations:'disabled',caret:'initial'}),contentType:'image/png'});
    expect.soft(response?.status(),'document status').toBeLessThan(400);
    expect.soft(geometry.scroll,'document horizontal overflow').toBeLessThanOrEqual(geometry.viewport+1);
    expect.soft(controls.length,'visible interactive controls').toBeGreaterThan(0);
    expect.soft(errors,'console and runtime errors').toEqual([]);
    expect.soft(resources,'failed resources; external resources intentionally blocked are reported').toEqual([]);
  });
}
for(const {route,access} of inventory.pages.filter(p=>!['public','development fixture','recovery form; session needed to submit'].includes(p.access))) {
  test.skip(`${route} authenticated workflow BLOCKED`, {annotation:{type:'blocked',description:`${access} requires an authorized dedicated test session and isolated backend; none supplied. No bypass or synthetic session.`}},()=>{});
}
