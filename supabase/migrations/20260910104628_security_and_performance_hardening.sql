-- Restrict direct invocation of the auth trigger helper.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Cover every foreign key reported by the Supabase performance advisor.
create index if not exists admin_profit_logs_user_id_idx on public.admin_profit_logs (user_id);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index if not exists conversations_branch_of_idx on public.conversations (branch_of);
create index if not exists conversations_project_id_idx on public.conversations (project_id);
create index if not exists generation_jobs_hold_id_idx on public.generation_jobs (hold_id);
create index if not exists generation_jobs_model_id_idx on public.generation_jobs (model_id);
create index if not exists manual_payments_reviewed_by_idx on public.manual_payments (reviewed_by);
create index if not exists message_attachments_conversation_id_idx on public.message_attachments (conversation_id);
create index if not exists message_attachments_file_id_idx on public.message_attachments (file_id);
create index if not exists message_attachments_user_id_idx on public.message_attachments (user_id);
create index if not exists messages_model_id_idx on public.messages (model_id);
create index if not exists messages_parent_message_id_idx on public.messages (parent_message_id);
create index if not exists model_price_history_created_by_idx on public.model_price_history (created_by);
create index if not exists platform_errors_user_id_idx on public.platform_errors (user_id);
create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
create index if not exists ticket_messages_user_id_idx on public.ticket_messages (user_id);

-- Keep the canonical normalized uniqueness constraint and remove redundant copies.
drop index if exists public.manual_payments_method_reference_unique_idx;
drop index if exists public.manual_payments_reference_unique;

-- Cache auth.uid() once per statement and scope end-user policies to authenticated users.
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "wallet own read" on public.wallets;
create policy "wallet own read" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "transactions own read" on public.wallet_transactions;
create policy "transactions own read" on public.wallet_transactions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "holds own read" on public.wallet_holds;
create policy "holds own read" on public.wallet_holds for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "payments own read" on public.manual_payments;
create policy "payments own read" on public.manual_payments for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "projects own all" on public.projects;
create policy "projects own all" on public.projects for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "conversations own all" on public.conversations;
create policy "conversations own all" on public.conversations for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "messages own read" on public.messages;
create policy "messages own read" on public.messages for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "jobs own read" on public.generation_jobs;
create policy "jobs own read" on public.generation_jobs for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "tickets own read" on public.support_tickets;
create policy "tickets own read" on public.support_tickets for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "tickets own insert" on public.support_tickets;
create policy "tickets own insert" on public.support_tickets for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "files own all" on public.user_files;
create policy "files own all" on public.user_files for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "attachments own all" on public.message_attachments;
create policy "attachments own all" on public.message_attachments for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "ticket messages own read" on public.ticket_messages;
create policy "ticket messages own read" on public.ticket_messages for select to authenticated
using (exists (select 1 from public.support_tickets t where t.id = ticket_messages.ticket_id and t.user_id = (select auth.uid())));
drop policy if exists "ticket messages own insert" on public.ticket_messages;
create policy "ticket messages own insert" on public.ticket_messages for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and author_role = 'user'
  and exists (select 1 from public.support_tickets t where t.id = ticket_messages.ticket_id and t.user_id = (select auth.uid()))
);

drop policy if exists "analytics own insert" on public.analytics_events;
create policy "analytics own insert" on public.analytics_events for insert to authenticated
with check ((select auth.uid()) = user_id or user_id is null);
drop policy if exists "analytics own read" on public.analytics_events;
create policy "analytics own read" on public.analytics_events for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "platform errors own insert" on public.platform_errors;
create policy "platform errors own insert" on public.platform_errors for insert to authenticated
with check ((select auth.uid()) = user_id or user_id is null);
