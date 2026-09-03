export default function AdminSidebar(){

return (

<aside className="app-sidebar">


<div className="sidebar-brand">

<div className="brand">

<div className="brand-mark"></div>

<span>
All Model Hub
</span>

</div>

</div>



<div className="sidebar-section">
Admin
</div>



<nav className="sidebar-nav">


<a 
href="/admin"
className="sidebar-link"
>
Dashboard
</a>


<a
href="/admin/payments"
className="sidebar-link"
>
Payments
</a>


<a
href="/admin/models"
className="sidebar-link"
>
Models
</a>


<a
href="/admin/users"
className="sidebar-link"
>
Users
</a>


<a
href="/admin/settings"
className="sidebar-link"
>
Settings
</a>


</nav>


</aside>

)

}
