import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function POST(
request:Request
){

const supabase = await createClient();


const {
paymentId
}=await request.json();



const {data:payment,error}=await supabase
.from("manual_payments")
.select("*")
.eq("id",paymentId)
.single();



if(error || !payment){

return NextResponse.json(
{
error:"Payment not found"
},
{
status:404
}
)

}




// update payment status

await supabase
.from("manual_payments")
.update({

status:"approved"

})
.eq(
"id",
paymentId
);




// add wallet credits

await supabase
.from("wallets")
.update({

balance:
payment.amount

})
.eq(
"user_id",
payment.user_id
);





// create transaction

await supabase
.from("transactions")
.insert({

user_id:payment.user_id,

amount:payment.amount,

type:"credit",

description:
"Manual payment approved"

});





return NextResponse.json({

success:true

});


}
