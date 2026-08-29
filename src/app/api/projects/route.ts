import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
const schema=z.object({name:z.string().min(2).max(80),instructions:z.string().max(10000).optional(),preferredTier:z.enum(["auto","budget","balanced","premium","flagship"]).default("auto"),preferredLanguage:z.string().max(40).default("auto")});
export async function GET(){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)return NextResponse.json({error:"Unauthorized"},{status:401});const admin=createAdminClient();const {data:projects,error}=await admin.from("projects").select("*").eq("user_id",data.user.id).order("updated_at",{ascending:false});if(error){logServerError("projects-list",error,{userId:data.user.id});return NextResponse.json({error:"Could not load projects."},{status:500});}return NextResponse.json({projects});}
export async function POST(request:Request){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)return NextResponse.json({error:"Unauthorized"},{status:401});const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid project"},{status:400});const admin=createAdminClient();const {data:project,error}=await admin.from("projects").insert({user_id:data.user.id,name:parsed.data.name,instructions:parsed.data.instructions,preferred_tier:parsed.data.preferredTier,preferred_language:parsed.data.preferredLanguage}).select("*").single();if(error){logServerError("project-create",error,{userId:data.user.id});return NextResponse.json({error:"Could not create project."},{status:500});}return NextResponse.json({project},{status:201});}
