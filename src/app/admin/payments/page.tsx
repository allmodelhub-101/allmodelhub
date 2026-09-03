import { createClient } from "@/lib/supabase/server";


export default async function PaymentsPage(){


const supabase =
await createClient();



const {data:payments}=await supabase
.from("manual_payments")
.select("*")
.order(
"created_at",
{
ascending:false
}
);



return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-8">

Payment Approvals

</h1>



<div className="space-y-4">


{
payments?.map((payment)=>(


<div
key={payment.id}
className="
border
rounded-xl
p-5
bg-white
dark:bg-black
"
>


<p>
User:
{payment.user_id}
</p>


<p>
Amount:
PKR {payment.amount}
</p>


<p>
Status:
{payment.status}
</p>


<button
className="
mt-4
px-5
py-2
rounded-lg
bg-green-600
text-white
"
>

Approve

</button>



</div>


))
}


</div>


</div>

)

}
