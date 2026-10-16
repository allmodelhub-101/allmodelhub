import { test as base, expect } from '@playwright/test';
// This suite never authenticates. The network guard also prevents accidental mutations.
export const test = base.extend<{ safeNetwork: void }>({
  safeNetwork: [async ({context, baseURL}, use) => {
    const origin = new URL(baseURL!).origin;
    await context.route('**/*', async route => {
      const request=route.request(), url=new URL(request.url());
      const mutation=!['GET','HEAD','OPTIONS'].includes(request.method());
      if ((url.origin !== origin && /^https?:$/.test(url.protocol)) ||
          mutation) {
        await route.abort('blockedbyclient'); return;
      }
      await route.continue();
    });
    await use();
  }, {auto:true}],
});
export {expect};
