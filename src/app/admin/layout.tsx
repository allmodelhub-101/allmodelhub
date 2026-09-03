import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/admin/check-admin";


export default async function AdminLayout({
children
}:{
children:React.ReactNode
}){


const supabase=await createClient();


const {data}=await supabase.auth.getUser();


if(!data.user){
redirect("/auth/login");
}


const allowed=await checkAdmin(data.user.id);


if(!allowed){
redirect("/");
}


return (
<div>
{children}
</div>
)

}
