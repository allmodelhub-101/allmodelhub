import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const admin = createAdminClient();
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 30), 1), 100);
  const activeOnly = request.nextUrl.searchParams.get("active") === "true";
  let query = admin
    .from("generation_jobs")
    .select("id,public_id,project_id,modality,model_id,status,prompt,result_urls,estimated_credits,charged_credits,error_message,created_at,updated_at,completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (activeOnly) query = query.in("status", ["queued", "submitted", "processing", "settling"]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to load generations." }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}

