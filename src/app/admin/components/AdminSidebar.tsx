const links=[["Overview","/admin","OV"],["Payments","/admin?tab=payments","$"],["Models","/admin?tab=models","AI"],["Providers","/admin?tab=providers","PR"],["Users","/admin?tab=users","US"],["Jobs","/admin?tab=jobs","JB"],["Support","/admin?tab=support","SP"],["Platform","/admin?tab=settings","ST"]] as const;
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



<div className="sidebar-section">Operations</div><nav className="sidebar-nav">{links.map(([label,href,mark])=><a href={href} className="sidebar-link" key={label}><b className="admin-nav-mark">{mark}</b><span>{label}</span></a>)}</nav><a className="admin-back-link" href="/chat"><b className="admin-nav-mark">↗</b>Return to workspace</a>


</aside>

)

}

