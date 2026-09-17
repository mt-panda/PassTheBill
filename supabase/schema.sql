create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid not null references members(id),
  title text not null default '',
  ordered_on date not null default current_date,
  delivery_charge numeric(10,2) not null default 0 check (delivery_charge >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  qty int not null check (qty > 0)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references order_items(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  units int not null check (units > 0),
  unique (item_id, member_id)
);

create table settlements (
  member_id uuid not null references members(id) on delete cascade,
  month date not null,
  team_id uuid not null references teams(id) on delete cascade,
  settled_at timestamptz not null default now(),
  primary key (member_id, month)
);

create function my_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from members where id = auth.uid()
$$;

create function create_team(p_team_name text, p_member_name text) returns teams
language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into teams (name) values (trim(p_team_name)) returning * into t;
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name));
  return t;
end $$;

create function join_team(p_code text, p_member_name text) returns teams
language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into t from teams where code = upper(trim(p_code));
  if t.id is null then raise exception 'no team with code %', p_code; end if;
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name))
  on conflict (id) do update set team_id = excluded.team_id, name = excluded.name;
  return t;
end $$;

create function close_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from orders where id = p_order_id and team_id = my_team_id() and status = 'open') then
    raise exception 'order not found or already closed';
  end if;
  if exists (
    select 1 from order_items i
    left join claims c on c.item_id = i.id
    where i.order_id = p_order_id
    group by i.id, i.qty
    having coalesce(sum(c.units), 0) <> i.qty
  ) then
    raise exception 'every unit must be claimed before closing';
  end if;
  update orders set status = 'closed' where id = p_order_id;
end $$;

create function check_claim_units() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qty int; v_taken int;
begin
  select qty into v_qty from order_items where id = new.item_id;
  select coalesce(sum(units), 0) into v_taken from claims where item_id = new.item_id and id <> new.id;
  if v_taken + new.units > v_qty then
    raise exception 'only % unit(s) left', v_qty - v_taken;
  end if;
  return new;
end $$;

create trigger claims_units before insert or update on claims
for each row execute function check_claim_units();

create function check_item_qty() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_taken int;
begin
  select coalesce(sum(units), 0) into v_taken from claims where item_id = new.id;
  if new.qty < v_taken then
    raise exception '% unit(s) already claimed', v_taken;
  end if;
  return new;
end $$;

create trigger items_qty before update on order_items
for each row execute function check_item_qty();

alter table teams enable row level security;
alter table members enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table claims enable row level security;
alter table settlements enable row level security;

create policy "read own team" on teams for select using (id = my_team_id());

create policy "read teammates" on members for select using (team_id = my_team_id());
create policy "rename self" on members for update using (id = auth.uid()) with check (team_id = my_team_id());

create policy "read team orders" on orders for select using (team_id = my_team_id());
create policy "create order" on orders for insert
  with check (team_id = my_team_id() and created_by = auth.uid() and status = 'open');
create policy "creator edits open order" on orders for update
  using (created_by = auth.uid() and status = 'open')
  with check (created_by = auth.uid() and status = 'open');
create policy "creator deletes open order" on orders for delete
  using (created_by = auth.uid() and status = 'open');

create policy "read items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id));
create policy "creator writes items" on order_items for all
  using (exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open'))
  with check (exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open'));

create policy "read claims" on claims for select
  using (exists (select 1 from order_items i join orders o on o.id = i.order_id where i.id = item_id));
create policy "own claims on open orders" on claims for all
  using (member_id = auth.uid() and exists (
    select 1 from order_items i join orders o on o.id = i.order_id where i.id = item_id and o.status = 'open'))
  with check (member_id = auth.uid() and exists (
    select 1 from order_items i join orders o on o.id = i.order_id where i.id = item_id and o.status = 'open'));

create policy "team settlements" on settlements for all
  using (team_id = my_team_id()) with check (team_id = my_team_id());

create view order_member_totals with (security_invoker = on) as
select
  o.id as order_id,
  o.team_id,
  o.ordered_on,
  o.status,
  c.member_id,
  sum(c.units * i.unit_price) as items_total,
  o.delivery_charge / count(*) over (partition by o.id) as delivery_share
from orders o
join order_items i on i.order_id = o.id
join claims c on c.item_id = i.id
group by o.id, c.member_id;

create view member_month_totals with (security_invoker = on) as
select
  t.team_id,
  t.member_id,
  m.name as member_name,
  date_trunc('month', t.ordered_on)::date as month,
  sum(t.items_total) as items_total,
  sum(t.delivery_share) as delivery_total,
  sum(t.items_total + t.delivery_share) as grand_total,
  bool_and(t.status = 'closed') as all_closed,
  s.settled_at
from order_member_totals t
join members m on m.id = t.member_id
left join settlements s on s.member_id = t.member_id and s.month = date_trunc('month', t.ordered_on)::date
group by t.team_id, t.member_id, m.name, date_trunc('month', t.ordered_on), s.settled_at;

alter publication supabase_realtime add table orders, order_items, claims, settlements;
