import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedPublic = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
]);
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean)
  .filter((file) => !file.endsWith("pnpm-lock.yaml") && !file.startsWith(".next/"));
const failures = [];

for (const file of files) {
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }

  for (const match of content.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    if (!allowedPublic.has(match[0])) failures.push(`${file}: disallowed public environment name ${match[0]}`);
  }

  if (file !== ".env.example") {
    const secretPatterns = [
      /\bsk-[A-Za-z0-9_-]{24,}\b/,
      /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
      /(?:SERVICE_ROLE_KEY|CALLBACK_SECRET|API_KEY)\s*=\s*[^\s#][^\r\n]{15,}/
    ];
    if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`${file}: possible committed secret`);
  }
}

const generationRoute = readFileSync("src/app/api/generations/[modality]/route.ts", "utf8");
if (/request_json:\s*providerBody/.test(generationRoute)) failures.push("generation route persists provider callback credentials");
if (/provider_task_id:\s*task\.taskId[^\n]+NextResponse/.test(generationRoute)) failures.push("generation route returns provider task identifiers");

const providerSource = readFileSync("src/lib/providers/apimodels.ts", "utf8");
if (/clone\(\)\.text\(\)/.test(providerSource)) failures.push("provider response bodies are logged");

for (const file of files.filter((file) => file.startsWith("src/app/api/admin/") && file.endsWith("route.ts"))) {
  const source = readFileSync(file, "utf8");
  if (!/requireAdmin|checkAdmin/.test(source)) failures.push(`${file}: admin route lacks an explicit role check`);
}

if (failures.length) {
  console.error(`Security checks failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Security checks passed across ${files.length} tracked/unignored files.`);
