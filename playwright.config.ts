import { defineConfig } from '@playwright/test';

const sizes = [[320,568],[360,800],[375,812],[390,844],[430,932],[844,390],[600,960],[768,1024],[900,900],[901,900],[1024,768],[1180,820],[1366,768],[1920,1080]];
const baseURL = process.env.PW_BASE_URL || 'http://127.0.0.1:3100';
const runLabel=process.env.PW_RUN_LABEL || 'baseline';
if(!/^[a-z0-9-]+$/.test(runLabel)) throw new Error('PW_RUN_LABEL must be a safe lowercase slug');
if (!['127.0.0.1','localhost','[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Responsive tests are local-only. Use a reviewed dedicated config for authorized previews.');
}
export default defineConfig({
  testDir: './tests/responsive', timeout: 60_000, expect: { timeout: 10_000 },
  fullyParallel: false, workers: process.env.CI ? 4 : 1, retries: 0,
  outputDir: `test-results/${runLabel}`,
  reporter: [['list'],['html',{open:'never',outputFolder:`playwright-report/${runLabel}`}],['json',{outputFile:`test-results/${runLabel}/results.json`}]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  use: { baseURL, serviceWorkers:'block', reducedMotion:'reduce', colorScheme:'light',
    trace:'retain-on-failure', screenshot:'only-on-failure', video:'off' },
  projects: (['chromium','webkit'] as const).flatMap(browserName => sizes.map(([width,height]) => ({
    name:`${browserName}-${width}x${height}`, use:{browserName, viewport:{width,height},
      isMobile: width <= 844 && height !== 768, hasTouch: width <= 1024, deviceScaleFactor:1},
  }))),
  webServer: {command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100', url:baseURL,
    reuseExistingServer:!process.env.CI, timeout:180_000,
    env:{LOCAL_RESPONSIVE_FIXTURES:'1', NEXT_TELEMETRY_DISABLED:'1', NEXT_PUBLIC_APP_URL:baseURL,
      NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',
      APIMODELS_API_KEY:'',HAIMAKER_API_KEY:'',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''}},
});
