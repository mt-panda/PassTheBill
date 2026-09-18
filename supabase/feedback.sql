-- PassTheBill feedback / bug reports / suggestions

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion')),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  platform text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  admin_notes text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "members can submit feedback"
on feedback for insert
with check (
  user_id = auth.uid()
  and team_id = my_team_id()
);

-- Keep feedback private from normal app users for now.
-- Review it later from Supabase Studio or an admin-only screen.
