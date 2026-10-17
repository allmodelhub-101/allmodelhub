# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interactions.spec.ts >> auth theme switch remains accessible at the current viewport
- Location: tests\responsive\interactions.spec.ts:2:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('.auth-nav-actions .theme-toggle')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" locator('.auth-nav-actions .theme-toggle') with timeout 10000ms
  - waiting for locator('.auth-nav-actions .theme-toggle')
    23 × locator resolved to <button class="theme-toggle" title="Switch to dark theme" aria-label="Switch to dark theme">…</button>
       - unexpected value "hidden"

```

```yaml
- main:
  - navigation:
    - link "Models Suite":
      - /url: /
    - link "Need help?":
      - /url: /support
  - region "Welcome back":
    - tablist "Account access mode":
      - tab "Sign in" [selected]
      - tab "Create account"
    - tabpanel:
      - text: Sign in to Models Suite
      - heading "Welcome back" [level=1]
      - paragraph: Continue where you left off.
      - button "Continue with Google":
        - img
        - text: Continue with Google
      - text: or continue with email Email address
      - textbox "Email address We’ll only use this to access your Models Suite account.":
        - /placeholder: you@example.com
      - text: We’ll only use this to access your Models Suite account. Password
      - textbox "Password Show password":
        - /placeholder: Enter your password
      - button "Show password":
        - img
      - button "Forgot password?"
      - button "Sign in to workspace":
        - text: Sign in to workspace
        - img
      - text: New to Models Suite?
      - button "Create an account"
      - paragraph:
        - img
        - text: Encrypted session · Protected by Supabase Auth
  - text: © 2026 Models Suite
  - link "Privacy":
    - /url: /privacy
  - link "Terms":
    - /url: /terms
- alert
```

# Test source

```ts
  1  | import { test, expect } from './safety';
  2  | test('auth theme switch remains accessible at the current viewport',async({page})=>{
  3  |   await page.goto('/auth/login',{waitUntil:'networkidle'});
  4  |   const theme=page.locator('.auth-nav-actions .theme-toggle');
  5  |   await expect(theme).toHaveAttribute('aria-label',/Switch to/);
> 6  |   await expect(theme).toBeVisible();
     |                       ^ Error: expect(locator).toBeVisible() failed
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
  42 | test('safe video fixture model dropdown Escape from search',async({page})=>{
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
