export default function AdminSidebar(){

return (

<aside
className="
w-64
min-h-screen
border-r
border-gray-800
bg-white
dark:bg-black
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



<nav
className="
space-y-4
"
>


<a href="/admin">
Dashboard
</a>


<a href="/admin/payments">
Payments
</a>


<a href="/admin/models">
Models
</a>


<a href="/admin/users">
Users
</a>


<a href="/admin/settings">
Settings
</a>


</nav>



</aside>


)

}
