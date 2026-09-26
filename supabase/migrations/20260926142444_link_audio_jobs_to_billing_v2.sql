alter table public.generation_jobs
  add column if not exists billing_quote_id uuid references public.billing_quotes(id) on delete restrict;

create unique index if not exists generation_jobs_billing_quote_uidx
  on public.generation_jobs (billing_quote_id)
  where billing_quote_id is not null;

create function public.billing_complete_generation_quote(
  p_job_id uuid,
  p_usage jsonb,
  p_provider_task_id text,
  p_result_json jsonb,
  p_result_urls jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job public.generation_jobs%rowtype;
  v_quote public.billing_quotes%rowtype;
  v_result jsonb;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found or v_job.billing_quote_id is null or v_job.modality <> 'audio' then
    raise exception 'BILLING_AUDIO_JOB_NOT_SETTLEABLE';
  end if;
  if v_job.status = 'completed' then
    select jsonb_build_object(
      'receipt_id', r.id, 'usage_event_id', r.usage_event_id,
      'wallet_transaction_id', r.wallet_transaction_id,
      'charge_credits', r.charge_credits::text
    ) into v_result from public.billing_receipts r where r.generation_job_id = v_job.id;
    return v_result;
  end if;
  if v_job.status <> 'settling' then raise exception 'BILLING_AUDIO_JOB_NOT_SETTLING'; end if;

  select * into v_quote from public.billing_quotes where id = v_job.billing_quote_id;
  if not found or v_quote.status <> 'accepted' then raise exception 'BILLING_AUDIO_QUOTE_NOT_ACCEPTED'; end if;

  v_result := public.billing_settle_usage_quote(
    v_quote.id,
    'billing-v2-audio-capture:' || v_job.id::text,
    'billing-v2-audio-usage:' || v_job.id::text,
    p_usage,
    null,
    p_provider_task_id,
    null,
    null,
    v_quote.estimated_provider_cost_usd,
    v_quote.estimated_provider_cost_usd,
    v_quote.customer_quote_credits,
    'usage_calculated',
    null,
    v_job.id,
    jsonb_build_object('provider_task_id', p_provider_task_id, 'usage', p_usage),
    p_usage || jsonb_build_object('source', 'submitted_request_exact', 'providerTaskId', p_provider_task_id),
    p_metadata || jsonb_build_object('billing_v2', true, 'operation', 'audio_generation')
  );

  update public.generation_jobs
  set status = 'completed',
      charged_credits = v_quote.customer_quote_credits,
      result_json = p_result_json,
      result_urls = p_result_urls,
      completed_at = clock_timestamp(),
      updated_at = clock_timestamp(),
      error_message = null
  where id = v_job.id;
  return v_result;
end;
$function$;

revoke all on function public.billing_complete_generation_quote(uuid,jsonb,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.billing_complete_generation_quote(uuid,jsonb,text,jsonb,jsonb,jsonb)
  to service_role;

comment on function public.billing_complete_generation_quote(uuid,jsonb,text,jsonb,jsonb,jsonb)
  is 'Atomically settles a deterministic Billing V2 audio generation and completes its job with immutable usage and receipt records.';
