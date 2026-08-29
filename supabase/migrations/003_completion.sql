-- All Model Hub completion migration: notifications, templates, receipts helpers
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  title text not null,
  description text not null default '',
  prompt text not null,
  language text not null default 'en',
  pakistan_focused boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.prompt_templates(slug,category,title,description,prompt,language,pakistan_focused) values
('upwork-proposal','Freelancers','Upwork Proposal','Turn a job post into a tailored, natural proposal.','Write a concise, persuasive Upwork proposal for this job. Start with the client problem, show relevant capability, give a clear plan, avoid generic claims, and finish with one practical question. Job post: {{input}}','en',true),
('fiverr-gig','Freelancers','Fiverr Gig Writer','Create a strong Fiverr gig structure.','Create a Fiverr gig title, search tags, concise description, three package ideas, requirements, and FAQ for: {{input}}','en',true),
('daraz-listing','E-commerce','Daraz Listing','Create a conversion-focused local marketplace listing.','Write a clear Daraz product title, key benefits, specifications, description, FAQs, and buyer-friendly bullets for: {{input}}','en',true),
('whatsapp-promo','Marketing','WhatsApp Promotion','Short promotion copy made for WhatsApp.','Write a concise WhatsApp promotional message for a Pakistani audience. Keep it natural, clear, non-spammy, and include one direct CTA. Offer/details: {{input}}','en',true),
('roman-urdu-explainer','Students','Roman Urdu Explainer','Explain a difficult idea in simple Roman Urdu.','Explain the following topic in simple Roman Urdu with a short example and 3 key takeaways: {{input}}','roman-urdu',true),
('youtube-script','Creators','YouTube Script','Create a structured creator-ready script.','Create a YouTube script with a strong hook, clear sections, natural transitions, examples, and a concise CTA for: {{input}}','en',false)
on conflict (slug) do nothing;

alter table public.notifications enable row level security;
alter table public.prompt_templates enable row level security;

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "templates public read" on public.prompt_templates;
create policy "templates public read" on public.prompt_templates for select using (active = true);
