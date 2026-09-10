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
Payments
</a>


<a
href="/admin?tab=models"
className="sidebar-link"
>
Models
</a>


<a
href="/admin?tab=providers"
className="sidebar-link"
>
Providers
</a>


<a
href="/admin?tab=users"
className="sidebar-link"
>
Users
</a>


<a
href="/admin?tab=jobs"
className="sidebar-link"
>
Jobs
</a>

<a href="/admin?tab=support" className="sidebar-link">
Support
</a>

<a href="/admin?tab=settings" className="sidebar-link">
Settings
</a>


</nav>


</aside>

)

}
