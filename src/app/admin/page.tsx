import { getAdminStats } from "@/lib/admin/dashboard";


export default async function AdminDashboard(){

const stats = await getAdminStats();


// Profit Calculation
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


// Failed jobs
const failedJobs =
stats.jobs.filter(
(job)=>job.status==="failed"
).length;


// Provider cost
const providerCost =
stats.jobs.reduce(
(sum,job)=>{

return sum + Number(job.internal_cost_pkr || 0);

},0
);



const cards = [

{
title:"Total Revenue",
value:`PKR ${stats.transactions.reduce(
(sum,t)=>sum + Number(t.amount || 0),
0
).toFixed(2)}`
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

<div className="p-8 space-y-8">

<h1
className="
text-4xl
font-bold
mb-8
"
>
All Model Hub Admin
</h1>


<div
className="
grid
grid-cols-1
sm:grid-cols-2
xl:grid-cols-3
gap-6
"
>


{
cards.map((card)=>(

<div
key={card.title}
className="
rounded-2xl
border
border-gray-200
dark:border-gray-800
p-6
bg-white
dark:bg-gray-900
shadow-lg
"
>


<p
className="
text-gray-500
dark:text-gray-400
"
>

{card.title}

</p>


<h2
className="
text-3xl
font-bold
mt-3
"
>

{card.value}

</h2>


</div>

))

}


</div>


</div>

)

}
