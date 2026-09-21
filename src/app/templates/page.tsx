import { AppShell } from "@/components/app-shell";
import { TemplateLibrary } from "@/components/template-library";
import type { PromptTemplate } from "@/components/template-library";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Templates() {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from("prompt_templates").select("id,slug,category,title,description,prompt,language,pakistan_focused").eq("active", true).order("category");
  return <AppShell><TemplateLibrary templates={(data || []) as PromptTemplate[]} /></AppShell>;
}
