import {test,expect} from './safety';

test('hardening: saved email hydration, route modes and local validation',async({page,context})=>{
 const errors:string[]=[],requests:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/**',async route=>{requests.push(route.request().url());await route.abort()});
 await page.addInitScript(()=>sessionStorage.setItem('models-suite-auth-email','synthetic@example.invalid'));
 await page.goto('/auth/login',{waitUntil:'networkidle'});
 const email=page.getByRole('textbox',{name:'Email',exact:true});
 await expect(email).toHaveValue('synthetic@example.invalid');
 await email.fill('edited@example.invalid');
 await page.getByLabel('Password',{exact:true}).fill('Synthetic1!');
 await page.getByRole('group',{name:'Account access mode'}).getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
 await expect(email).toHaveValue('edited@example.invalid');
 await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
 await expect(page).toHaveURL(/\/auth\/signup/);
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Forgot password?'}).click();
 await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();
 await email.fill('invalid');
 await page.getByRole('button',{name:'Send reset link'}).click();
 await expect(email).toHaveAttribute('aria-invalid','true');
 await expect(page.locator('.auth-form-panel').getByRole('alert')).toHaveCount(1);
 await expect(page.locator('#email-error')).toContainText('Enter a valid email');
 await page.getByRole('button',{name:'Back to sign in'}).click();
 await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'Show password'}).click();
 await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
 expect(errors).toEqual([]);expect(requests,'invalid local form must not reach auth APIs').toEqual([]);
});

test('hardening: auth uses a loaded Google mark and one credential error',async({page})=>{
 await page.route('**/api/auth/login',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'INVALID_CREDENTIALS'})}));
 await page.goto('/auth/login',{waitUntil:'networkidle'});
 const logo=page.locator('.auth-google img');
 await expect(logo).toHaveAttribute('src','/google-g.png');
 expect(await logo.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
 await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');
 await page.getByLabel('Password',{exact:true}).fill('Synthetic1!');
 await page.locator('.auth-form').getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.auth-form-panel').getByRole('alert')).toHaveCount(1);
 await expect(page.locator('.auth-form-panel').getByRole('alert')).toHaveText('Email or password is incorrect. Please try again.');
 await expect(page.locator('.auth-field-error')).toHaveCount(0);
 await page.getByLabel('Email',{exact:true}).fill('edited@example.invalid');
 await expect(page.locator('.auth-form-panel').getByRole('alert')).toHaveCount(0);
 await expect(page.locator('.auth-field-error')).toHaveCount(0);
});

test('hardening: premium admin motion respects the browser preference',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/responsive-fixture?surface=admin',{waitUntil:'networkidle'});
 const live=page.locator('.admin-live i');
 expect(await live.evaluate(el=>getComputedStyle(el).animationName)).not.toBe('none');
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await live.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('hardening: video rail stops offscreen work and resumes visible motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/responsive-fixture?studio=video',{waitUntil:'networkidle'});
 await expect(page.getByRole('button',{name:'Pause model scrolling'})).toBeVisible();
 const rail=page.locator('[aria-label="Available video models"]');await rail.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
 await rail.evaluate(el=>{
  let proto:object|null=el,descriptor:PropertyDescriptor|undefined;
  while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'scrollLeft');proto=Object.getPrototypeOf(proto)}
  el.setAttribute('data-writes','0');
  Object.defineProperty(el,'scrollLeft',{get(){return descriptor!.get!.call(this)},set(v){this.setAttribute('data-writes',String(Number(this.getAttribute('data-writes'))+1));descriptor!.set!.call(this,v)}});
 });
 await expect.poll(()=>rail.getAttribute('data-writes')).not.toBe('0');
 await page.locator('.app-content').evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:'instant'}));
 // Very wide/short pages may not have enough content to scroll the rail entirely out.
 const offscreen=await rail.evaluate(el=>el.getBoundingClientRect().bottom<0);
 if(offscreen){await page.waitForTimeout(150);await rail.evaluate(el=>el.setAttribute('data-writes','0'));await page.waitForTimeout(250);await expect(rail).toHaveAttribute('data-writes','0')}
 await rail.scrollIntoViewIfNeeded();await expect.poll(async()=>Number(await rail.getAttribute('data-writes'))).toBeGreaterThan(0);
 const pause=page.getByRole('button',{name:'Pause model scrolling'});await pause.click();await expect(page.getByRole('button',{name:'Resume model scrolling'})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'Resume model scrolling'})).toHaveCount(0);
});
