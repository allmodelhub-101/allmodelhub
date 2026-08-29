import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  CALLBACK_SECRET: z.string().min(16).optional(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional()
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }
  return result.data;
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing public Supabase environment variables.");
  return { url, key };
}
