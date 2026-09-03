import { getAdminStats } from "@/lib/admin/dashboard";


export default async function AdminDashboard(){

const stats = await getAdminStats();



const totalProfit =
stats.jobs.reduce(
(sum,job)=>{

const charged =
Number(job.charged_credits || job.estimated_credits || 0);

const cost =
Number(job.internal_cost_pkr || 0);


return sum + (charged - cost);

},0
);



const failedJobs =
stats.jobs.filter(
(job)=>job.status==="failed"
).length;



const providerCost =
stats.jobs.reduce(
(sum,job)=>{

return sum + Number(job.internal_cost_pkr || 0);

},0
);



const revenue =
stats.transactions.reduce(
(sum,t)=>sum + Number(t.amount || 0),
0
);



const cards=[


{
title:"Total Revenue",
value:`PKR ${revenue.toFixed(2)}`
},


{
title:"Total Profit",
value:`PKR ${totalProfit.toFixed(2)}`
},


{
title:"Total Users",
value:stats.users
},


{
title:"AI Generations",
value:stats.jobs.length
},


{
title:"Provider Cost",
value:`PKR ${providerCost.toFixed(2)}`
},


{
title:"Failed Jobs",
value:failedJobs
}


];



return (

<div>


<div className="page-head">

<div>

<h1 className="page-title">
All Model Hub Admin
</h1>


<p className="muted">
Platform overview and business analytics
</p>


</div>


</div>



<div className="stats-grid">


{
cards.map((card)=>(

<div
key={card.title}
className="card stat-card"
>


<span>
{card.title}
</span>


<strong>
{card.value}
</strong>


</div>


))
}


</div>


</div>

)


}
