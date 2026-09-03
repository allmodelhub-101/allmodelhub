import { createAdminClient } from "@/lib/supabase/admin";

export async function checkAdmin(userId:string){

const supabase = createAdminClient();

const {data,error}=await supabase
.from("admin_roles")
.select("*")
.eq("user_id",userId)
.single();


if(error || !data){
return false;
}


return data.role==="owner";
}
