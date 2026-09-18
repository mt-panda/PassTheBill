create table if not exists billing_cycles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  triggered_by uuid not null references members(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists one_open_billing_cycle_per_team
  on billing_cycles(team_id) where status = 'open';

create table if not exists billing_cycle_orders (
  cycle_id uuid not null references billing_cycles(id) on delete cascade,
  order_id uuid not null references orders(id) on delete restrict,
  primary key (cycle_id, order_id),
  unique (order_id)
);

create table if not exists billing_cycle_confirmations (
  cycle_id uuid not null references billing_cycles(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  confirmed_at timestamptz,
  primary key (cycle_id, member_id)
);

alter table billing_cycles enable row level security;
alter table billing_cycle_orders enable row level security;
alter table billing_cycle_confirmations enable row level security;

drop policy if exists "team cycles" on billing_cycles;
create policy "team cycles" on billing_cycles for select using (team_id = my_team_id());

drop policy if exists "team cycle orders" on billing_cycle_orders;
create policy "team cycle orders" on billing_cycle_orders for select
  using (exists (select 1 from billing_cycles c where c.id = cycle_id and c.team_id = my_team_id()));

drop policy if exists "team cycle confirmations" on billing_cycle_confirmations;
create policy "team cycle confirmations" on billing_cycle_confirmations for select
  using (exists (select 1 from members m where m.id = member_id and m.team_id = my_team_id()));

create or replace view billing_cycle_member_totals with (security_invoker = on) as
select
  c.id as cycle_id,
  c.team_id,
  m.id as member_id,
  m.name as member_name,
  coalesce(sum(t.items_total), 0) as items_total,
  coalesce(sum(t.delivery_share), 0) as delivery_total,
  coalesce(sum(t.extras_total), 0) as extras_total,
  coalesce(sum(t.items_total + t.delivery_share + t.extras_total), 0) as grand_total,
  cf.confirmed_at
from billing_cycles c
join members m on m.team_id = c.team_id
left join billing_cycle_orders co on co.cycle_id = c.id
left join order_member_totals t on t.order_id = co.order_id and t.member_id = m.id
left join billing_cycle_confirmations cf on cf.cycle_id = c.id and cf.member_id = m.id
group by c.id, c.team_id, m.id, m.name, cf.confirmed_at;

create or replace view untallied_closed_orders with (security_invoker = on) as
select o.id
from orders o
where o.team_id = my_team_id()
  and o.status = 'closed'
  and not exists (select 1 from billing_cycle_orders co where co.order_id = o.id);

create or replace function trigger_billing_cycle() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cycle billing_cycles;
  v_members uuid[];
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_cycle from billing_cycles
  where team_id = my_team_id() and status = 'open'
  order by created_at desc
  limit 1;

  if v_cycle.id is null then
    insert into billing_cycles (team_id, triggered_by)
    values (my_team_id(), auth.uid())
    returning * into v_cycle;

    insert into billing_cycle_orders (cycle_id, order_id)
    select v_cycle.id, o.id
    from orders o
    where o.team_id = my_team_id()
      and o.status = 'closed'
      and not exists (select 1 from billing_cycle_orders co where co.order_id = o.id);

    -- Only members who actually owe something in this cycle need to confirm.
    -- Members with a zero total remain visible in the tally but do not block closing.
    insert into billing_cycle_confirmations (cycle_id, member_id)
    select
      v_cycle.id,
      t.member_id
    from order_member_totals t
    join billing_cycle_orders co on co.order_id = t.order_id
    where co.cycle_id = v_cycle.id
    group by t.member_id
    having sum(t.items_total + t.delivery_share + t.extras_total) > 0;

    select array_agg(member_id) into v_members
    from billing_cycle_confirmations
    where cycle_id = v_cycle.id;

    if v_members is not null then
      perform send_push(
        v_members,
        'Tally started',
        'Your team tally is ready. Tap to confirm your total.',
        '/totals'
      );
    end if;
  end if;

  return v_cycle.id;
end $$;

create or replace function confirm_billing_cycle(p_cycle_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update billing_cycle_confirmations cf
  set confirmed_at = now()
  where cf.cycle_id = p_cycle_id
    and cf.member_id = auth.uid()
    and exists (
      select 1
      from billing_cycles c
      where c.id = p_cycle_id
        and c.team_id = my_team_id()
        and c.status = 'open'
    );

  if not found then raise exception 'cycle not found or already closed'; end if;
end $$;

create or replace function close_billing_cycle(p_cycle_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from billing_cycles
    where id = p_cycle_id
      and team_id = my_team_id()
      and triggered_by = auth.uid()
      and status = 'open'
  ) then
    raise exception 'only the person who started this tally can close it';
  end if;

  if exists (
    select 1
    from billing_cycle_confirmations
    where cycle_id = p_cycle_id
      and confirmed_at is null
  ) then
    raise exception 'all participating members must confirm before closing the cycle';
  end if;

  update billing_cycles
  set status = 'closed', closed_at = now()
  where id = p_cycle_id;
end $$;

alter publication supabase_realtime add table billing_cycles, billing_cycle_confirmations;
notify pgrst, 'reload schema';
