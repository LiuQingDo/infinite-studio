-- Read-only foundation. Task creation and uploads remain disabled until server validation and budgets exist.
create table public.image_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('queued', 'submitting', 'running', 'succeeded', 'failed', 'unknown')),
  created_at timestamptz not null default now()
);
create index image_tasks_owner_created_idx on public.image_tasks (owner_id, created_at desc);
alter table public.image_tasks enable row level security;
revoke all on public.image_tasks from anon, authenticated;
grant select on public.image_tasks to authenticated;
create policy "owners read tasks" on public.image_tasks for select to authenticated
  using (owner_id = (select auth.uid()));

create table public.image_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  created_at timestamptz not null default now()
);
create index image_assets_owner_created_idx on public.image_assets (owner_id, created_at desc);
alter table public.image_assets enable row level security;
revoke all on public.image_assets from anon, authenticated;
grant select on public.image_assets to authenticated;
create policy "owners read assets" on public.image_assets for select to authenticated
  using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public) values ('studio-private', 'studio-private', false);
create policy "owners read private objects" on storage.objects for select to authenticated
  using (bucket_id = 'studio-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
