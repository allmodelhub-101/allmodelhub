# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interactions.spec.ts >> safe video fixture model dropdown Escape from search
- Location: tests\responsive\interactions.spec.ts:36:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('button', { name: /Choose a video model:/ })
Expected: "false"
Received: "true"
Timeout:  10000ms

Call log:
  - Expect "toHaveAttribute" getByRole('button', { name: /Choose a video model:/ }) with timeout 10000ms
  - waiting for getByRole('button', { name: /Choose a video model:/ })
    23 × locator resolved to <button type="button" aria-expanded="true" aria-haspopup="listbox" aria-controls="video-model-options" aria-label="Choose a video model: MiniMax H3 Lite" class="video-studio-v2-module__bOxVpW__modelTrigger">…</button>
       - unexpected value "true"

```

```yaml
- 'button "Choose a video model: MiniMax H3 Lite" [expanded]':
  - text: MiniMax H3 Lite MiniMax · budget
  - img
```

# Test source

```ts
  1  | import { test, expect } from './safety';
  2  | test('auth theme switch remains accessible at the current viewport',async({page})=>{
  3  |   await page.goto('/auth/login',{waitUntil:'networkidle'});
  4  |   const theme=page.locator('.auth-nav-actions .theme-toggle');
  5  |   await expect(theme).toHaveAttribute('aria-label',/Switch to/);
  6  |   await expect(theme).toBeVisible();
  7  | });
  8  | test('marketing navigation opens, closes with Escape and navigates',async({page})=>{
  9  |   await page.goto('/');
  10 |   await expect(page.locator('.marketing-nav .theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
  11 |   const menu=page.getByRole('button',{name:'Open navigation menu'});
  12 |   if(await menu.isVisible()) {
  13 |     await menu.click();
  14 |     await expect(page.getByRole('navigation',{name:'Mobile navigation',exact:true})).toBeVisible();
  15 |     await page.keyboard.press('Escape');
  16 |     await expect(menu).toHaveAttribute('aria-expanded','false');
  17 |     await menu.click();
  18 |     await page.locator('#marketing-mobile-menu').getByRole('link',{name:'Login',exact:true}).click();
  19 |   } else {
  20 |     await page.getByRole('link',{name:'Login',exact:true}).first().click();
  21 |   }
  22 |   await expect(page).toHaveURL(/\/auth\/login/,{timeout:45_000});
  23 |   await expect(page.getByRole('textbox',{name:/email/i})).toBeVisible();
  24 | });
  25 | test('login form focus, typing, password visibility and reduced viewport',async({page})=>{
  26 |   await page.goto('/auth/login');
  27 |   const email=page.getByRole('textbox',{name:/email/i});
  28 |   await email.fill('responsive-test@example.invalid');
  29 |   await expect(email).toBeFocused();
  30 |   const password=page.locator('input[type="password"]');
  31 |   await password.fill('ExampleOnly!123');
  32 |   await page.getByRole('button',{name:'Show password'}).click();
  33 |   await expect(page.locator('input[autocomplete="current-password"]')).toHaveAttribute('type','text');
  34 |   const size=page.viewportSize()!;
  35 |   await page.setViewportSize({width:size.width,height:Math.max(280,size.height-300)});
  36 |   await email.focus();
  37 |   await email.scrollIntoViewIfNeeded();
  38 |   await expect(email).toBeInViewport();
  39 |   await expect(page.getByRole('button',{name:/sign in/i}).last()).toBeEnabled();
  40 |   // Browser emulation cannot reproduce a real iOS/Android software keyboard.
  41 | });
> 42 | test('safe video fixture model dropdown Escape from search',async({page})=>{
     |                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  43 |   await page.goto('/studio-fixture',{waitUntil:'networkidle'});
  44 |   const picker=page.getByRole('button',{name:/Choose a video model:/});
  45 |   await picker.click();
  46 |   await expect(page.getByRole('listbox',{name:'Available video models'})).toBeVisible();
  47 |   await page.keyboard.press('Escape');
  48 |   await expect(picker).toHaveAttribute('aria-expanded','false');
  49 | });
  50 | test('safe video fixture form and viewer modal',async({page})=>{
  51 |   await page.goto('/studio-fixture',{waitUntil:'networkidle'});
  52 |   await page.getByRole('textbox',{name:'Scene direction'}).fill('A quiet mountain at sunrise');
  53 |   await page.getByRole('button',{name:'Explore',exact:true}).click();
  54 |   await page.getByRole('button',{name:/Open .+ full video viewer/}).first().click();
  55 |   await expect(page.getByRole('dialog')).toBeVisible();
  56 |   await page.keyboard.press('Escape');
  57 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  58 | });
  59 |
```
