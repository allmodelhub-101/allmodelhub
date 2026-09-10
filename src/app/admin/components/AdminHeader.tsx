export default function AdminHeader({ email }: { email?: string }){

return (

<header className="app-topbar">


<h1 className="page-title">

Admin Control Center

</h1>


<div className="wallet-chip">

<span className="status-dot"></span>

{email || "Administrator"}


</div>


</header>

)

}
