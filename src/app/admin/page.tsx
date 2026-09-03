const cards = [
  {
    title: "Total Revenue",
    value: "PKR 0"
  },
  {
    title: "Total Profit",
    value: "PKR 0"
  },
  {
    title: "Total Users",
    value: "0"
  },
  {
    title: "AI Generations",
    value: "0"
  },
  {
    title: "Provider Cost",
    value: "PKR 0"
  },
  {
    title: "Failed Jobs",
    value: "0"
  }
];


import { getAdminStats } from "@/lib/admin/dashboard";


export default async function AdminDashboard(){

const stats = await getAdminStats();
return (

<div className="p-8">

<h1 className="
text-4xl
font-bold
mb-8
">
All Model Hub Admin
</h1>


<div className="
grid
grid-cols-1
md:grid-cols-3
gap-6
">


{
cards.map((card)=>(

<div
key={card.title}
className="
rounded-2xl
border
p-6
bg-white
dark:bg-black
shadow-sm
"
>

<p className="
text-gray-500
dark:text-gray-400
">

{card.title}

</p>


<h2 className="
text-3xl
font-bold
mt-3
">

{card.value}

</h2>


</div>

))

}


</div>


</div>

)

}
