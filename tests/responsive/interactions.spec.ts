import { test, expect } from './safety';
test('auth theme switch remains accessible at the current viewport',async({page})=>{
  await page.goto('/auth/login',{waitUntil:'networkidle'});
  const theme=page.locator('.auth-nav-actions .theme-toggle');
  await expect(theme).toHaveAttribute('aria-label',/Switch to/);
  await expect(theme).toBeVisible();
});
test('marketing navigation opens, closes with Escape and navigates',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.marketing-nav .theme-toggle')).toHaveAttribute('aria-label',/Switch to/);
  const menu=page.getByRole('button',{name:'Open navigation menu'});
  if(await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole('navigation',{name:'Mobile navigation',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded','false');
    await menu.click();
    await page.locator('#marketing-mobile-menu').getByRole('link',{name:'Login',exact:true}).click();
  } else {
    await page.getByRole('link',{name:'Login',exact:true}).first().click();
  }
  await expect(page).toHaveURL(/\/auth\/login/,{timeout:45_000});
  await expect(page.getByRole('textbox',{name:/email/i})).toBeVisible();
});
test('login form focus, typing, password visibility and reduced viewport',async({page})=>{
  await page.goto('/auth/login');
  const email=page.getByRole('textbox',{name:/email/i});
  await email.fill('responsive-test@example.invalid');
  await expect(email).toBeFocused();
  const password=page.locator('input[type="password"]');
  await password.fill('ExampleOnly!123');
  await page.getByRole('button',{name:'Show password'}).click();
  await expect(page.locator('input[autocomplete="current-password"]')).toHaveAttribute('type','text');
  const size=page.viewportSize()!;
  await page.setViewportSize({width:size.width,height:Math.max(280,size.height-300)});
  await email.focus();
  await email.scrollIntoViewIfNeeded();
  await expect(email).toBeInViewport();
  await expect(page.getByRole('button',{name:/sign in/i}).last()).toBeEnabled();
  // Browser emulation cannot reproduce a real iOS/Android software keyboard.
});
test('safe video fixture model dropdown Escape from search',async({page})=>{
  await page.goto('/studio-fixture',{waitUntil:'networkidle'});
  const picker=page.getByRole('button',{name:/Choose a video model:/});
  await picker.click();
  await expect(page.getByRole('listbox',{name:'Available video models'})).toBeVisible();
  await expect(page.getByPlaceholder('Search live video models')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveAttribute('aria-expanded','false');
  await expect(picker).toBeFocused();
  await picker.click();await page.getByPlaceholder('Search live video models').fill('FlashVSR');
  await expect(page.getByRole('option')).toHaveCount(1);await page.keyboard.press('Enter');
  await expect(picker).toContainText('FlashVSR');await expect(picker).toBeFocused();
  await picker.click();await page.getByPlaceholder('Search live video models').fill('no-matching-model');
  await expect(page.getByRole('option')).toHaveCount(0);await page.keyboard.press('Escape');await expect(picker).toBeFocused();
});
test('safe video fixture form and viewer modal',async({page})=>{
  await page.goto('/studio-fixture',{waitUntil:'networkidle'});
  await page.getByRole('textbox',{name:'Scene direction'}).fill('A quiet mountain at sunrise');
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.getByRole('button',{name:/Open .+ full video viewer/}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
