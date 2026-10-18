import {AppShell} from '@/components/app-shell';
import {UsageWorkspace} from '@/components/usage-workspace';
import {requireUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
export const dynamic='force-dynamic';
function karachiDayStart(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=(type:string)=>parts.find(part=>part.type===type)?.value||"";return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+05:00`).toISOString()}
async function loadUsagePresentation(){
  const user=await requireUser();const admin=createAdminClient();
  const [{data:tx},{data:messages},{data:jobs},{data:profile},{data:todayTx},{data:receipts},{data:quotes},{data:usageEvents}]=await Promise.all([
    admin.from("wallet_transactions").select("id,type,amount,balance_after,reference_id,metadata,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
    admin.from("messages").select("id,model_id,provider_key,input_tokens,output_tokens,credits_charged,metadata,created_at").eq("user_id",user.id).eq("role","assistant").order("created_at",{ascending:false}).limit(50),
    admin.from("generation_jobs").select("id,public_id,modality,model_id,status,charged_credits,estimated_credits,reserved_credits,billing_quote_id,created_at,completed_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50),
    admin.from("profiles").select("daily_spend_limit,single_generation_limit").eq("id",user.id).single(),
    admin.from("wallet_transactions").select("amount").eq("user_id",user.id).eq("type","generation_capture").gte("created_at",karachiDayStart()),
    admin.from("billing_receipts").select("id,quote_id,usage_event_id,provider_key,model_id,pricing_version,cost_status,charge_credits,message_id,generation_job_id,metadata,settled_at").eq("user_id",user.id).order("settled_at",{ascending:false}).limit(100),
    admin.from("billing_quotes").select("id,provider_key,model_id,pricing_version,pricing_status,customer_quote_credits,reservation_credits,input_dimensions,pricing_snapshot,status,expires_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50),
    admin.from("billing_usage_events").select("id,provider_request_id,provider_task_id,input_tokens,output_tokens,reasoning_tokens,cached_input_tokens,cache_write_tokens,characters,seconds,images,reference_images,resolution,quality,mode,fps,cost_status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
  ]);
  const spent=(tx||[]).filter(x=>x.type==="generation_capture").reduce((a,x)=>a+Math.abs(Number(x.amount)),0);
  const byModel=new Map<string,{credits:number,requests:number}>();
  if(receipts?.length){for(const row of receipts){const key=row.model_id||"Unknown",current=byModel.get(key)||{credits:0,requests:0};current.credits+=Number(row.charge_credits||0);current.requests+=1;byModel.set(key,current)}}else{for(const row of messages||[]){const key=row.model_id||"Auto Best",current=byModel.get(key)||{credits:0,requests:0};current.credits+=Number(row.credits_charged||0);current.requests+=1;byModel.set(key,current)}for(const row of jobs||[]){const key=row.model_id||"Unknown",current=byModel.get(key)||{credits:0,requests:0};current.credits+=Number(row.charged_credits||0);current.requests+=1;byModel.set(key,current)}}
  const modelSpend=[...byModel.entries()].map(([model,value])=>({model,...value})).sort((a,b)=>b.credits-a.credits);
  const todaySpent=(todayTx||[]).reduce((sum,row)=>sum+Math.abs(Number(row.amount)),0),dailyLimit=Number(profile?.daily_spend_limit||0),singleLimit=Number(profile?.single_generation_limit||0),dailyPercent=dailyLimit?Math.min(100,(todaySpent/dailyLimit)*100):0;
  const usageById=new Map((usageEvents||[]).map(row=>[row.id,row]));const receiptByQuote=new Map((receipts||[]).map(row=>[row.quote_id,row]));const receiptedMessageIds=new Set((receipts||[]).map(row=>row.message_id).filter(Boolean));const legacyMessages=(messages||[]).filter(row=>{const metadata=row.metadata&&typeof row.metadata==="object"?row.metadata as Record<string,unknown>:{};return row.credits_charged!=null&&!receiptedMessageIds.has(row.id)&&metadata.billingEngine!=="v3_provider_authoritative"&&!metadata.billingQuoteId&&!metadata.billingStatus});
  const metrics=[{label:"AI spend",value:spent.toFixed(2),note:"Credits",icon:"coins" as const,tone:"cyan"},{label:"Billing receipts",value:receipts?.length||0,note:"Text, audio & media",icon:"file" as const,tone:"violet"},{label:"Media jobs",value:jobs?.length||0,note:"Images, video & audio",icon:"image" as const,tone:"green"},{label:"Credit value",value:"Rs1",note:"per Credit",icon:"wallet" as const,tone:"amber"}];
  return {metrics,modelSpend,todaySpent,dailyPercent,dailyLimit,singleLimit,tx,receipts,quotes,jobs,legacyMessages,usageById,receiptByQuote};}
export default async function UsagePage(){return <AppShell><UsageWorkspace {...await loadUsagePresentation()}/></AppShell>}
