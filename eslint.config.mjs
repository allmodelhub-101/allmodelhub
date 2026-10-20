import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "android/tools/node_modules/**", "android/**/build/**", "coverage/**", "playwright-report/**", "test-results/**", "blob-report/**"])
]);
