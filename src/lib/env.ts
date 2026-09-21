import "server-only";
import { z } from "zod";

const placeholderPattern = /^(change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example|test[-_ ])/i;

function productionSecret(name: string, minimum: number) {
  return z.string().min(minimum).superRefine((value, context) => {
    if (process.env.NODE_ENV === "production" && placeholderPattern.test(value)) {
      context.addIssue({ code: "custom", message: `${name} must not use a placeholder value in production` });
    }
  });
}

const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: productionSecret("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", 20),
  SUPABASE_SERVICE_ROLE_KEY: productionSecret("SUPABASE_SERVICE_ROLE_KEY", 32),
  APIMODELS_API_KEY: z.string().min(1).optional(),
  APIMODELS_BASE_URL: z.string().url().default("https://api.apimodels.app/v1"),
  HAIMAKER_API_KEY: z.string().min(1).optional(),
  HAIMAKER_BASE_URL: z.string().url().default("https://api.haimaker.ai/v1"),
  HAIMAKER_MODEL_MAP_JSON: z.string().default("{}"),
  INTERNAL_USD_PKR: z.coerce.number().positive().default(310),
  WELCOME_CREDITS: z.coerce.number().min(0).default(10),
  EASYPAISA_ACCOUNT_TITLE: z.string().optional(),
  EASYPAISA_ACCOUNT_NUMBER: z.string().optional(),
  MEEZAN_ACCOUNT_TITLE: z.string().optional(),
  MEEZAN_IBAN: z.string().optional(),
  MEEZAN_ACCOUNT_NUMBER: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),
  CALLBACK_SECRET: productionSecret("CALLBACK_SECRET", 32).optional(),
  CALLBACK_SECRET_PREVIOUS: productionSecret("CALLBACK_SECRET_PREVIOUS", 32).optional(),
  PROVIDER_ASSET_HOST_ALLOWLIST: z.string().default(""),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional()
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }
  if (process.env.NODE_ENV === "production") {
    const missing: string[] = [];
    if (!result.data.UPSTASH_REDIS_REST_URL || !result.data.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
    if (!result.data.CALLBACK_SECRET) missing.push("CALLBACK_SECRET");
    if (!result.data.APIMODELS_API_KEY && !result.data.HAIMAKER_API_KEY) missing.push("APIMODELS_API_KEY or HAIMAKER_API_KEY");
    if (!parseAssetHosts(result.data.PROVIDER_ASSET_HOST_ALLOWLIST).length) missing.push("PROVIDER_ASSET_HOST_ALLOWLIST");
    if (missing.length) throw new Error(`Missing production security configuration: ${missing.join(", ")}`);
  }
  return result.data;
}

export function parseAssetHosts(value = process.env.PROVIDER_ASSET_HOST_ALLOWLIST ?? "") {
  return [...new Set(value.split(",").map((host) => host.trim().toLowerCase().replace(/^\.+/, "")).filter(Boolean))];
}

export function isAllowedAssetHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return parseAssetHosts().some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}
