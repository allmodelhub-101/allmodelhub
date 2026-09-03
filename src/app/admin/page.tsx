export default function AdminDashboard(){
return <main className="p-8">
<h1 className="text-4xl font-bold">All Model Hub Control Center</h1>
<div className="grid md:grid-cols-3 gap-5 mt-8">
{["Revenue","Profit","Provider Cost","Users","Generations","Failed Jobs"].map(x=>
<div className="border rounded-2xl p-6" key={x}>
<h2>{x}</h2><strong>0</strong>
</div>)}
</div>
</main>
}
