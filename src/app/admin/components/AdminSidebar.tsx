import Link from "next/link";


export default function AdminSidebar(){

return (

<aside
className="
w-64
min-h-screen
border-r
bg-white
dark:bg-black
dark:border-gray-800
p-6
"
>


<h2
className="
text-xl
font-bold
mb-8
"
>
All Model Hub
</h2>


<nav className="space-y-3">


<Link
href="/admin"
className="
block
rounded-lg
px-3
py-2
hover:bg-gray-100
dark:hover:bg-gray-900
"
>
Dashboard
</Link>


<Link
href="/admin/payments"
className="
block
rounded-lg
px-3
py-2
hover:bg-gray-100
dark:hover:bg-gray-900
"
>
Payments
</Link>


<Link
href="/admin/models"
className="
block
rounded-lg
px-3
py-2
hover:bg-gray-100
dark:hover:bg-gray-900
"
>
Models
</Link>


<Link
href="/admin/users"
className="
block
rounded-lg
px-3
py-2
hover:bg-gray-100
dark:hover:bg-gray-900
"
>
Users
</Link>


<Link
href="/admin/settings"
className="
block
rounded-lg
px-3
py-2
hover:bg-gray-100
dark:hover:bg-gray-900
"
>
Settings
</Link>


</nav>


</aside>

)

}
