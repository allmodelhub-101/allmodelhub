import { NextRequest,NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
 const user=await requireUser();
 const q=(request.nextUrl.searchParams.get("q")||"").trim().replace(/[%_,()]/g,"").slice(0,80);
 if(q.length<2)return NextResponse.json({results:[]});
 const admin=createAdminClient(),pattern=`%${q}%`;
 const [chats,jobs,files]=await Promise.all([
  admin.from("conversations").select("id,title,preferred_model,updated_at").eq("user_id",user.id).eq("archived",false).eq("private",false).ilike("title",pattern).order("updated_at",{ascending:false}).limit(5),
  admin.from("generation_jobs").select("id,modality,model_id,prompt,status,created_at").eq("user_id",user.id).ilike("prompt",pattern).order("created_at",{ascending:false}).limit(5),
  admin.from("user_files").select("id,name,mime_type,created_at").eq("user_id",user.id).ilike("name",pattern).order("created_at",{ascending:false}).limit(5)
 ]);
 const results=[
  ...(chats.data||[]).map(item=>({id:item.id,kind:"chat",label:item.title,detail:item.preferred_model||"Conversation",href:`/chat?conversation=${encodeURIComponent(item.id)}`})),
  ...(jobs.data||[]).map(item=>({id:item.id,kind:"generation",label:item.prompt||item.model_id,detail:`${item.modality} · ${item.status} · ${item.model_id}`,href:`${item.modality==="image"?"/images":`/${item.modality}`}?model=${encodeURIComponent(item.model_id)}&prompt=${encodeURIComponent(item.prompt||"")}`})),
  ...(files.data||[]).map(item=>({id:item.id,kind:"file",label:item.name,detail:item.mime_type,href:`/chat?file=${encodeURIComponent(item.id)}`}))
 ];
 return NextResponse.json({results});
}

