import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { ALL_MODELS } from "../../src/lib/models.ts";
import { evaluateModelReadiness } from "../../src/lib/model-readiness-core.ts";
import { getMediaExecutionContract, mediaContractUiSchema } from "../../src/lib/media-execution-contract.ts";
const migration = (name) => readFileSync(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const v2 = migration("20260926115825_create_billing_v2_schema.sql");
const v3 = migration("20260928182225_add_billing_v3_provider_authoritative.sql");
const repair = migration("20261005203530_video_v3_native_authorization.sql");
function table(sql, name) {
  const start = sql.indexOf("create table public." + name + " (");
  let statement = sql.slice(start, sql.indexOf("\n);", start) + 3);
  // PGlite fixture lacks btree_gist. All numeric, FK, unique and financial
  // constraints remain real; overlap exclusion is tested in Supabase preview.
  statement = statement.replace(/,\n  constraint \w+_active_window_excl exclude using gist \([\s\S]*?\) where \([^\n]*\)/, "");
  return statement;
}
function fn(sql, name) {
  const prefix = "function public." + name + "(";
  const position = sql.indexOf(prefix);
  const start = sql.lastIndexOf("create", position);
  return sql.slice(start, sql.indexOf("$function$;", start) + 11);
}
test("forward migration and real V3 RPCs preserve exact wallet/receipt invariants", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create type public.job_status as enum ('queued','submitted','processing','settling','completed','failed','cancelled','expired');
      create table public.models(id text primary key, active boolean default true, markup numeric default 2, ui_schema jsonb default '{}');
      create table public.provider_models(provider_key text,model_id text,upstream_model text,active boolean default true);
      create table public.system_settings(key text primary key,value jsonb);
      create table public.request_idempotency(id uuid primary key,user_id uuid,status text);
      create table public.wallets(user_id uuid primary key,purchased_balance numeric,promo_balance numeric,reserved_balance numeric,updated_at timestamptz);
      create table public.wallet_holds(id uuid primary key default gen_random_uuid(),user_id uuid,amount numeric,status text,idempotency_key text unique,finalized_at timestamptz);
      create table public.wallet_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,type text,bucket text,amount numeric,reference_id text,idempotency_key text unique,balance_before numeric,balance_after numeric,metadata jsonb);
      create table public.messages(id uuid primary key,user_id uuid,credits_charged numeric,supplier_cost_usd numeric,internal_cost_pkr numeric,metadata jsonb);
      create table public.generation_jobs(id uuid primary key,user_id uuid,modality text,result_urls jsonb,status public.job_status,charged_credits numeric,completed_at timestamptz,updated_at timestamptz,error_message text);
      create table public.projects(id uuid primary key,user_id uuid);
      create table public.user_files(id uuid primary key default gen_random_uuid(),user_id uuid,project_id uuid,storage_path text unique,name text,mime_type text,size_bytes bigint,extracted_text text,extraction_status text default 'stored',created_at timestamptz default now());
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      insert into public.system_settings values ('internal_usd_pkr','280'),('billing_v2_wallet_reservation_quantum_credits','0.01'),('billing_v2_quote_ttl_seconds','300');
    `);
    for (const name of ["provider_pricing_rules", "billing_quotes", "billing_usage_events", "billing_receipts", "billing_anomalies"]) await db.exec(table(v2, name));
    await db.exec(table(v3, "billing_authorization_policies"));
    await db.exec(table(v3, "provider_billing_records"));
    const alterStart = v3.indexOf("alter table public.billing_quotes\n");
    await db.exec(v3.slice(alterStart, v3.indexOf("\n\ncreate index", alterStart)));
    await db.exec("alter table public.billing_quotes add wallet_hold_id uuid, add reservation_kind text, add reservation_basis jsonb");
    await db.exec(migration("20260926121106_add_billing_pricing_registry_view.sql"));
    await db.exec(`
      create function public.create_wallet_hold(u uuid,a numeric,k text,m jsonb) returns uuid language plpgsql as $$
      declare h uuid; begin
        select id into h from public.wallet_holds where idempotency_key=k;
        if h is not null then return h; end if;
        update public.wallets set reserved_balance=reserved_balance+a where user_id=u and purchased_balance+promo_balance-reserved_balance>=a;
        if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
        insert into public.wallet_holds(user_id,amount,status,idempotency_key) values(u,a,'active',k) returning id into h;
        return h; end $$;
      create function public.release_wallet_hold(h uuid,r text) returns void language plpgsql as $$
      declare a numeric; u uuid; begin
        update public.wallet_holds set status='released' where id=h and status='active' returning amount,user_id into a,u;
        if found then update public.wallets set reserved_balance=reserved_balance-a where user_id=u; end if;
      end $$;
    `);
    const models = ALL_MODELS.filter((model) => model.modality === "video");
    for (const model of models) {
      await db.query("insert into public.models(id) values ($1)", [model.id]);
      await db.query("insert into public.provider_models values ('apimodels',$1,$2,true)", [model.id, model.upstreamModel]);
    }
    // Reuse actual four September price rows and actual six executable
    // policies. No fabricated production strategy enters this fixture.
    const historical = migration("20260927020934_complete_billing_v2_pricing_registry.sql");
    const videoInsert = historical.match(/insert into public.provider_pricing_rules \([\s\S]*?'gemini-omni-1-1-flash'[\s\S]*?on conflict [^;]+;/)?.[0];
    assert.ok(videoInsert);
    // Extract only video VALUES statement; prior image/audio inserts have
    // catalog FKs not included in this isolated video fixture.
    const start = historical.lastIndexOf("insert into public.provider_pricing_rules", historical.indexOf("'gemini-omni-1-1-flash'"));
    await db.exec(historical.slice(start, historical.indexOf(";", start) + 1));
    await db.exec(migration("20260929202000_media_video_contract_repair.sql"));
    await db.exec(fn(v3, "billing_v3_settle_provider_record"));
    await db.exec(repair);
    await db.exec(migration("0061_storage_quotas.sql"));
    await db.exec(migration("20261006052727_video_private_media_uploads.sql"));
    await db.exec(fn(v3, "billing_v3_release_authoritative_failure"));
    await db.exec(fn(v3, "billing_protect_quote_snapshot"));
    await db.exec("create trigger billing_quotes_protect_snapshot before update on public.billing_quotes for each row execute function public.billing_protect_quote_snapshot()");
    const policies = (await db.query("select * from public.billing_v3_authorization_registry")).rows;
    assert.equal(policies.length, 11);
    for (const policy of policies) {
      const model = models.find((model) => model.id === policy.model_id);
      assert.equal(evaluateModelReadiness({ model: { ...model, markup: 2, uiSchema: mediaContractUiSchema(getMediaExecutionContract(model.id)) },
        active: true, routes: [policy], policies: [policy], configurationReady: true }).ready, true, model.id);
    }
    const user = randomUUID();
    await db.query("insert into auth.users values ($1)", [user]);
    await db.query("insert into public.wallets values ($1,10000,0,0,now())", [user]);
    const session = randomUUID();
    const reservation = (await db.query("select public.reserve_file_upload($1,1000,10000) id",[user])).rows[0].id;
    await db.query("insert into public.media_upload_sessions(id,user_id,reservation_id,storage_path,destination_path,name,mime_type,size_bytes) values($1::uuid,$2::uuid,$3::uuid,$1::uuid::text,$2::uuid::text||'/'||$1::uuid::text,'source.mp4','video/mp4',1000)",[session,user,reservation]);
    const finalize = () => db.query("select public.finalize_media_upload($1,$2,'{\"duration\":12.5}') result",[session,user]);
    const finalized = await Promise.all([finalize(),finalize()]);
    assert.ok(finalized.every((r)=>r.rows[0].result.id===session));
    assert.equal((await db.query("select count(*)::int n from public.user_files")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from public.file_upload_reservations")).rows[0].n,0);
    await assert.rejects(db.query("select public.finalize_media_upload($1,$2,'{}')",[session,randomUUID()]),/MEDIA_UPLOAD_NOT_FOUND/);
    assert.equal((await db.query("select has_function_privilege('anon','public.finalize_media_upload(uuid,uuid,jsonb)','execute') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.media_upload_sessions','select') allowed")).rows[0].allowed,false);
    assert.ok((await db.query("select * from storage.buckets")).rows.every((b)=>b.public===false));
    const policy = policies.find((policy) => policy.model_id === "ltx-2-3");
    async function reserve(fx = 280, markup = 2, claim = randomUUID()) {
      await db.query("insert into public.request_idempotency values ($1,$2,'processing') on conflict do nothing", [claim, user]);
      const args = [user,claim,policy.id,"apimodels",policy.model_id,policy.upstream_model,"video",0.2*fx*markup,
        {},claim,{authorization_fx:String(fx),authorization_markup:String(markup),authorization_provider_cost_usd:"0.2"}];
      const call = () => db.query("select public.billing_v3_reserve_authorization($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result", args).then((r) => r.rows[0].result);
      return { args, call, result: await call() };
    }
    const first = await reserve();
    await assert.rejects(db.query("update public.billing_quotes set internal_usd_pkr_rate=999 where id=$1",[first.result.quote_id]),/BILLING_QUOTE_SNAPSHOT_IMMUTABLE/);
    await assert.rejects(db.query("update public.billing_quotes set frozen_markup=9 where id=$1",[first.result.quote_id]),/BILLING_QUOTE_SNAPSHOT_IMMUTABLE/);
    const retries = await Promise.all([first.call(), first.call(), first.call()]);
    assert.ok(retries.every((quote) => quote.quote_id === first.result.quote_id));
    assert.equal((await db.query("select count(*)::int as n from public.wallet_holds")).rows[0].n, 1);
    await db.exec("update public.system_settings set value='300' where key='internal_usd_pkr'; update public.models set markup=3 where id='ltx-2-3'");
    assert.equal((await db.query("select internal_usd_pkr_rate from public.billing_v3_authorization_registry where model_id='ltx-2-3'")).rows[0].internal_usd_pkr_rate, "300");
    assert.equal((await first.call()).fx, "280.000000000000000000");
    const second = await reserve(300, 3);
    assert.equal(Number(second.result.authorization_credits), 180);
    async function record(quote, state, cost) {
      const id = randomUUID();
      await db.query("insert into public.provider_billing_records(id,provider_key,quote_id,user_id,model_id,provider_task_id,state,settled,credits_usd,currency,source) values ($1::uuid,'apimodels',$2,$3,$4,$1::text,$5,true,$6,'USD','records_api')",
        [id,quote.quote_id,user,policy.model_id,state,cost]);
      return id;
    }
    const recordId = await record(first.result,"completed","0.1");
    const settle = () => db.query("select public.billing_v3_settle_provider_record($1) as result",[recordId]).then((r) => r.rows[0].result);
    const settled = await Promise.all([settle(),settle(),settle()]);
    assert.ok(settled.every((result) => result.status === "settled" && Number(result.charge_credits) === 56));
    assert.equal((await db.query("select count(*)::int n from public.wallet_transactions")).rows[0].n, 1);
    assert.equal(Number((await db.query("select reserved_balance from public.wallets")).rows[0].reserved_balance),180);
    const failure = await record(second.result,"failed","0");
    await db.query("select public.billing_v3_release_authoritative_failure($1)",[failure]);
    await db.query("select public.billing_v3_release_authoritative_failure($1)",[failure]);
    assert.equal(Number((await db.query("select reserved_balance from public.wallets")).rows[0].reserved_balance),0);
    const third = await reserve(300,3);
    const shortfall = await record(third.result,"completed","0.3");
    const result = (await db.query("select public.billing_v3_settle_provider_record($1) result",[shortfall])).rows[0].result;
    assert.equal(result.status,"authorization_shortfall");
    assert.equal((await db.query("select public.billing_v3_settle_provider_record($1) result",[shortfall])).rows[0].result.status,"authorization_shortfall");
    assert.equal((await db.query("select count(*)::int n from public.wallet_transactions")).rows[0].n,1);
    assert.equal(Number((await db.query("select purchased_balance from public.wallets")).rows[0].purchased_balance),9944);
    assert.equal((await db.query("select count(*)::int n from public.billing_receipts")).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from public.billing_anomalies")).rows[0].n,1);
    assert.equal((await db.query("select has_table_privilege('anon','public.provider_input_assets','select') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege('anon','public.billing_v3_settle_provider_record(uuid,jsonb,uuid,uuid,jsonb)','execute') allowed")).rows[0].allowed,false);
  } finally { await db.close(); }
});

