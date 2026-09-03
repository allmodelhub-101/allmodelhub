import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/admin/check-admin";

import AdminSidebar from "./components/AdminSidebar";
import AdminHeader from "./components/AdminHeader";


export default async function AdminLayout({
children
}:{
children:React.ReactNode
}){


const supabase = await createClient();


const {data} = await supabase.auth.getUser();


if(!data.user){
redirect("/auth/login");
}


const allowed = await checkAdmin(data.user.id);


if(!allowed){
redirect("/");
}



return (

<div
className="
flex
min-h-screen
bg-gray-50
dark:bg-black
"
>


<AdminSidebar />


<div
className="
flex-1
"
>


<AdminHeader />


<main>

{children}

</main>


</div>


</div>

)

}
