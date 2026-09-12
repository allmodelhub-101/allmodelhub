import {Activity,Brain,Briefcase,ChartLineUp,CreditCard,Gear,Headset,Network,UsersThree} from "@phosphor-icons/react/dist/ssr";
const links=[["Overview","/admin",ChartLineUp],["Payments","/admin?tab=payments",CreditCard],["Models","/admin?tab=models",Brain],["Providers","/admin?tab=providers",Network],["Users","/admin?tab=users",UsersThree],["Jobs","/admin?tab=jobs",Activity],["Support","/admin?tab=support",Headset],["Platform","/admin?tab=settings",Gear]] as const;
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



<div className="sidebar-section">Operations</div><nav className="sidebar-nav">{links.map(([label,href,Icon])=><a href={href} className="sidebar-link" key={label}><Icon weight="duotone"/><span>{label}</span></a>)}</nav><a className="admin-back-link" href="/chat"><Briefcase weight="duotone"/>Return to workspace</a>


</aside>

)

}

