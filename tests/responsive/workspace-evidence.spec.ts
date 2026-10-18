import {test,expect} from './safety';
import fs from 'node:fs/promises';
const surfaces=['history','projects','files','templates','models','battle','notifications'].filter(s=>!process.env.PW_CAPTURE_SURFACES||process.env.PW_CAPTURE_SURFACES.split(',').includes(s));
if(process.env.PW_WORKSPACE_CAPTURE)for(const surface of surfaces)test(`workspace evidence ${surface}`,async({page,context},info)=>{
 const api:string[]=[];await context.route('**/api/**',async route=>{api.push(route.request().url());await route.abort()});
 const phase=process.env.PW_WORKSPACE_CAPTURE!;if(!['before','after'].includes(phase))throw new Error('Invalid evidence phase');
 const theme=process.env.PW_WORKSPACE_CAPTURE_THEME||'light';const prefix=theme==='light'?'':theme+'-';
 await page.addInitScript(t=>localStorage.setItem('amh-theme',t),theme);
 await page.goto(`/responsive-fixture?surface=${surface}`,{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('data-workspace-data-ready',surface);
 const dir=`docs/mobile-phase5/batch-a/${phase}`;await fs.mkdir(dir,{recursive:true});
 await page.screenshot({path:`${dir}/${prefix}${surface}-${info.project.name}.png`,animations:'disabled'});
 const geometry=await page.locator('.app-content').evaluate(el=>({viewport:innerWidth,document:document.documentElement.scrollWidth,content:el.scrollWidth,width:el.clientWidth,shellClearance:getComputedStyle(document.querySelector('.app-main')!).paddingBottom,controls:[...el.querySelectorAll('button,input,select,textarea,a')].slice(0,30).map(e=>({tag:e.tagName,name:e.getAttribute('aria-label')||e.textContent?.slice(0,80),height:e.getBoundingClientRect().height,fontSize:getComputedStyle(e).fontSize})),grid:[...el.querySelectorAll('[class*=grid], [class*=tools]')].map(e=>({class:e.className,width:e.getBoundingClientRect().width,columns:getComputedStyle(e).gridTemplateColumns,overflow:getComputedStyle(e).overflowX}))}));
 await fs.writeFile(`${dir}/${prefix}${surface}-${info.project.name}.json`,JSON.stringify(geometry,null,2));
 if(phase==='after'){const target=page.locator(surface==='history'?'.library-card':surface==='projects'?'.project-card':surface==='files'?'.files-row':surface==='models'?'.model-card':surface==='battle'?'.battle-result':surface==='templates'?'.template-card':'.notification-row').first();await target.scrollIntoViewIfNeeded();await target.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:`${dir}/${prefix}${surface}-content-${info.project.name}.png`,animations:'disabled'});}
 if(phase==='after'&&surface==='history'){await page.locator('.library-file-main').click();await expect(page.getByRole('dialog',{name:'Asset details'})).toBeVisible();await page.screenshot({path:`${dir}/${prefix}history-details-${info.project.name}.png`,animations:'disabled'});await page.keyboard.press('Escape')}
 expect(api).toEqual([]);
});
