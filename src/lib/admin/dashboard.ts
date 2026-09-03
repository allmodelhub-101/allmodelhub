import { createAdminClient } from "@/lib/supabase/admin";


export async function getAdminStats(){

const supabase=createAdminClient();


const [
users,
jobs,
transactions
]=await Promise.all([


supabase
.from("profiles")
.select("*",{count:"exact",head:true}),


supabase
.from("generation_jobs")
.select("*"),


supabase
.from("transactions")
.select("*")


]);


return {


users:
users.count ?? 0,


generations:
jobs.data?.length ?? 0,


transactions:
transactions.data ?? [],


jobs:
jobs.data ?? []


};


}
