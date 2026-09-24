-- Rollback for redesign-release.sql: restores the live definitions captured on 2026-09-24.
-- Only run if the release must be reverted.

CREATE OR REPLACE FUNCTION public.create_team(p_team_name text, p_member_name text)
 RETURNS teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into teams (name) values (trim(p_team_name)) returning * into t;
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name));
  return t;
end $function$;

CREATE OR REPLACE FUNCTION public.join_team(p_code text, p_member_name text)
 RETURNS teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t teams;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into t from teams where code = upper(trim(p_code));
  if t.id is null then raise exception 'no team with code %', p_code; end if;
  insert into members (id, team_id, name) values (auth.uid(), t.id, trim(p_member_name))
  on conflict (id) do update set team_id = excluded.team_id, name = excluded.name;
  return t;
end $function$;

CREATE OR REPLACE FUNCTION public.close_billing_cycle(p_cycle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'Added by ' || v_creator || '. Tap to claim what you ate.',
      '/order/' || new.id
    );
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.trigger_billing_cycle()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.notify_extra_charge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      v_creator || ' added "' || new.label || '" to your ' || v_place || ' order. Tap to accept or reject.',
      '/order/' || new.order_id
    );
  elsif new.status = 'rejected' and old.status <> 'rejected' then
    perform send_push(
      array[v_order.created_by],
      'Extra charge rejected',
      v_member || ' rejected ' || rs(new.amount) || ' for "' || new.label || '" on ' || v_place || '.',
      '/order/' || new.order_id
    );
  end if;
  return new;
end $function$;

drop function if exists assert_can_leave_team(uuid);

drop policy if exists "team cycle confirmations" on billing_cycle_confirmations;
create policy "team cycle confirmations" on billing_cycle_confirmations for select
  using ((EXISTS ( SELECT 1
   FROM members m
  WHERE ((m.id = billing_cycle_confirmations.member_id) AND (m.team_id = my_team_id())))));

-- The redesign appended is_member; create or replace cannot drop a column, so recreate.
drop view if exists billing_cycle_member_totals;
create view billing_cycle_member_totals with (security_invoker=on) as  SELECT c.id AS cycle_id,
    c.team_id,
    m.id AS member_id,
    m.name AS member_name,
    COALESCE(sum(t.items_total), 0::numeric) AS items_total,
    COALESCE(sum(t.delivery_share), 0::numeric) AS delivery_total,
    COALESCE(sum(t.extras_total), 0::numeric) AS extras_total,
    COALESCE(sum(t.items_total + t.delivery_share + t.extras_total), 0::numeric) AS grand_total,
    cf.confirmed_at
   FROM billing_cycles c
     JOIN members m ON m.team_id = c.team_id
     LEFT JOIN billing_cycle_orders co ON co.cycle_id = c.id
     LEFT JOIN order_member_totals t ON t.order_id = co.order_id AND t.member_id = m.id
     LEFT JOIN billing_cycle_confirmations cf ON cf.cycle_id = c.id AND cf.member_id = m.id
  GROUP BY c.id, c.team_id, m.id, m.name, cf.confirmed_at;

notify pgrst, 'reload schema';
