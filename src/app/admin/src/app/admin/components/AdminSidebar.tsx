import Link from "next/link";


const menu = [

{
name:"Dashboard",
href:"/admin"
},

{
name:"Revenue",
href:"/admin/revenue"
},

{
name:"Profit Analytics",
href:"/admin/profit"
},

{
name:"Users",
href:"/admin/users"
},

{
name:"Wallet",
href:"/admin/wallet"
},

{
name:"Payments",
href:"/admin/payments"
},

{
name:"AI Generations",
href:"/admin/generations"
},

{
name:"Models",
href:"/admin/models"
},

{
name:"Providers",
href:"/admin/providers"
},

{
name:"Storage",
href:"/admin/storage"
},

{
name:"System Logs",
href:"/admin/logs"
},

{
name:"Settings",
href:"/admin/settings"
}


];


export default function AdminSidebar(){

return (

<aside
className="
w-64
min-h-screen
border-r
bg-white
dark:bg-black
dark:text-white
p-6
"
>


<h2
className="
text-2xl
font-bold
mb-8
"
>
All Model Hub
</h2>



<nav
className="
space-y-3
"
>


{
menu.map((item)=>(


<Link

key={item.href}

href={item.href}

className="
block
rounded-xl
px-4
py-3
hover:bg-gray-100
dark:hover:bg-gray-900
"

>

{item.name}

</Link>


))

}



</nav>


</aside>

)

}
