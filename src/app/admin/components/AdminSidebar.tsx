export default function AdminSidebar(){

return (

<aside
className="
w-64
min-h-screen
border-r
border-gray-200
dark:border-gray-800
bg-white
dark:bg-gray-950
p-6
"
>

<h2
className="
text-2xl
font-bold
mb-10
"
>
All Model Hub
</h2>


<nav
className="
flex
flex-col
gap-5
"
>


<a
className="
text-gray-700
dark:text-gray-300
hover:text-blue-500
"
href="/admin"
>
Dashboard
</a>


<a
className="
text-gray-700
dark:text-gray-300
hover:text-blue-500
"
href="/admin/payments"
>
Payments
</a>


<a
className="
text-gray-700
dark:text-gray-300
hover:text-blue-500
"
href="/admin/models"
>
Models
</a>


<a
className="
text-gray-700
dark:text-gray-300
hover:text-blue-500
"
href="/admin/users"
>
Users
</a>


<a
className="
text-gray-700
dark:text-gray-300
hover:text-blue-500
"
href="/admin/settings"
>
Settings
</a>


</nav>


</aside>

)

}
