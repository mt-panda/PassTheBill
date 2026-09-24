-- PassTheBill redesign: release SQL. Changes behaviour the old app can see, so apply it when the
-- redesign is being tested/released (see spec §10.2). Idempotent. Rollback: redesign-rollback.sql.

-- 1. Server-side team-switch guard (stops stranded open orders and stuck reviews).
create or replace function assert_can_leave_team(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  select team_id into v_team from members where id = auth.uid();
  if v_team is null or v_team = p_target then return; end if; -- new user, or not actually moving
  if exists (select 1 from orders where created_by = auth.uid() and team_id = v_team and status = 'open') then
    raise exception 'team switch blocked: open order';
  end if;
  if exists (
    select 1
    from billing_cycles c
    join billing_cycle_confirmations cf on cf.cycle_id = c.id and cf.member_id = auth.uid()
    where c.team_id = v_team and c.status = 'open' and cf.confirmed_at is null
  ) then
    raise exception 'team switch blocked: unconfirmed review';
  end if;
end $$;
revoke execute on function assert_can_leave_team(uuid) from public, anon, authenticated;

-- 2. create_team works for existing members (upsert), guarded.
create or replace function create_team(p_team_name text, p_member_name text) returns teams
language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform assert_can_leave_team(null);
  insert into teams (name) values (trim(p_team_name)) returning * into t;
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name))
  on conflict (id) do update set team_id = excluded.team_id, name = excluded.name;
  return t;
end $$;

-- 3. join_team, guarded (live definition + guard).
create or replace function join_team(p_code text, p_member_name text) returns teams
language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into t from teams where code = upper(trim(p_code));
  if t.id is null then raise exception 'no team with code %', p_code; end if;
  perform assert_can_leave_team(t.id);
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name))
  on conflict (id) do update set team_id = excluded.team_id, name = excluded.name;
  return t;
end $$;

-- 4. Confirmations are visible per review (not per current team membership), so a member who
--    confirmed and then left still shows as confirmed.
drop policy if exists "team cycle confirmations" on billing_cycle_confirmations;
create policy "team cycle confirmations" on billing_cycle_confirmations for select
  using (exists (select 1 from billing_cycles c where c.id = cycle_id and c.team_id = my_team_id()));

-- 5. Team totals include people who left (their shares no longer vanish). Same columns, same
--    arithmetic; `is_member` appended. security_invoker must be restated or it is dropped.
create or replace view billing_cycle_member_totals with (security_invoker = on) as
with people as (
  select c.id as cycle_id, m.id as member_id
  from billing_cycles c
  join members m on m.team_id = c.team_id
  union
  select co.cycle_id, t.member_id
  from billing_cycle_orders co
  join order_member_totals t on t.order_id = co.order_id
)
select
  c.id as cycle_id,
  c.team_id,
  p.member_id,
  coalesce(m.name, 'Former member') as member_name,
  coalesce(sum(t.items_total), 0::numeric) as items_total,
  coalesce(sum(t.delivery_share), 0::numeric) as delivery_total,
  coalesce(sum(t.extras_total), 0::numeric) as extras_total,
  coalesce(sum(t.items_total + t.delivery_share + t.extras_total), 0::numeric) as grand_total,
  cf.confirmed_at,
  (m.id is not null) as is_member
from people p
join billing_cycles c on c.id = p.cycle_id
left join members m on m.id = p.member_id and m.team_id = c.team_id
left join billing_cycle_orders co on co.cycle_id = c.id
left join order_member_totals t on t.order_id = co.order_id and t.member_id = p.member_id
left join billing_cycle_confirmations cf on cf.cycle_id = c.id and cf.member_id = p.member_id
group by c.id, c.team_id, p.member_id, m.id, m.name, cf.confirmed_at;

-- 6. Finishing a review: the starter, or anyone in the team once the starter has left; only
--    current members who owe something must have confirmed. Exception texts unchanged.
create or replace function close_billing_cycle(p_cycle_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v billing_cycles;
begin
  select * into v from billing_cycles
  where id = p_cycle_id and team_id = my_team_id() and status = 'open'
  for update;
  if v.id is null then raise exception 'cycle not found or already closed'; end if;

  if v.triggered_by is distinct from auth.uid()
     and exists (select 1 from members where id = v.triggered_by and team_id = v.team_id) then
    raise exception 'only the person who started this tally can close it';
  end if;

  if exists (
    select 1
    from billing_cycle_confirmations cf
    join members m on m.id = cf.member_id and m.team_id = v.team_id
    where cf.cycle_id = v.id
      and cf.confirmed_at is null
      and (select coalesce(sum(t.items_total + t.delivery_share + t.extras_total), 0)
           from billing_cycle_orders co
           join order_member_totals t on t.order_id = co.order_id
           where co.cycle_id = v.id and t.member_id = cf.member_id) > 0
  ) then
    raise exception 'all participating members must confirm before closing the cycle';
  end if;

  update billing_cycles set status = 'closed', closed_at = now() where id = v.id;
end $$;

-- 7. Plain-language push copy (live definitions; only strings changed; send_push untouched).
create or replace function notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_creator text;
  v_members uuid[];
begin
  select name into v_creator from members where id = new.created_by;
  select array_agg(id) into v_members from members where team_id = new.team_id and id <> new.created_by;
  if v_members is not null then
    perform send_push(
      v_members,
      coalesce('New order from ' || nullif(new.title, ''), 'New lunch order'),
      'Added by ' || v_creator || '. Tap to pick what you''re having.',
      '/order/' || new.id
    );
  end if;
  return new;
end $$;

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
    insert into billing_cycle_confirmations (cycle_id, member_id)
    select v_cycle.id, t.member_id
    from order_member_totals t
    join billing_cycle_orders co on co.order_id = t.order_id
    where co.cycle_id = v_cycle.id
    group by t.member_id
    having sum(t.items_total + t.delivery_share + t.extras_total) > 0;

    select array_agg(member_id) into v_members
    from billing_cycle_confirmations
    where cycle_id = v_cycle.id;

    if v_members is not null then
      perform send_push(v_members, 'Time to review lunches', 'Check your total and confirm it.', '/totals');
    end if;
  end if;

  return v_cycle.id;
end $$;

create or replace function notify_extra_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_creator text;
  v_member text;
  v_place text;
begin
  select * into v_order from orders where id = new.order_id;
  select name into v_creator from members where id = v_order.created_by;
  select name into v_member from members where id = new.member_id;
  v_place := coalesce(nullif(v_order.title, ''), 'lunch');

  if tg_op = 'INSERT' then
    perform send_push(
      array[new.member_id],
      'Extra charge: ' || rs(new.amount),
      v_creator || ' added "' || new.label || '" to your ' || v_place || ' order. Tap to accept or decline.',
      '/order/' || new.order_id
    );
  elsif new.status = 'rejected' and old.status <> 'rejected' then
    perform send_push(
      array[v_order.created_by],
      'Extra charge declined',
      v_member || ' declined ' || rs(new.amount) || ' for "' || new.label || '" on ' || v_place || '.',
      '/order/' || new.order_id
    );
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
