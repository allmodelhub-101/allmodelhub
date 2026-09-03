import {createAdminClient}
from "@/lib/supabase/admin";


export async function getProfitAnalytics(){

const admin=createAdminClient();


const {data}=await admin
.from("admin_profit_logs")
.select("*");


const totalProfit =
(data || [])
.reduce(
(sum,item)=>
sum + Number(item.profit_pkr || 0),
0
);


const totalRevenue =
(data || [])
.reduce(
(sum,item)=>
sum + Number(item.revenue_credits || 0),
0
);


const totalCost =
(data || [])
.reduce(
(sum,item)=>
sum + Number(item.provider_cost_pkr || 0),
0
);


return {

totalProfit,

totalRevenue,

totalCost,

history:data || []

};

}
