create table delivery_exclusions (
  order_id uuid not null references orders(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (order_id, member_id)
);

create table extra_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

alter table delivery_exclusions enable row level security;
alter table extra_charges enable row level security;

create policy "read exclusions" on delivery_exclusions for select
  using (exists (select 1 from orders o where o.id = order_id));
create policy "creator adds exclusions" on delivery_exclusions for insert
  with check (
    exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open')
    and exists (select 1 from members m where m.id = member_id and m.team_id = my_team_id()));
create policy "creator removes exclusions" on delivery_exclusions for delete
  using (exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open'));

create policy "read charges" on extra_charges for select
  using (exists (select 1 from orders o where o.id = order_id));
create policy "creator adds charges" on extra_charges for insert
  with check (
    status = 'pending'
    and exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open')
    and exists (select 1 from members m where m.id = member_id and m.team_id = my_team_id()));
create policy "creator removes charges" on extra_charges for delete
  using (exists (select 1 from orders o where o.id = order_id and o.created_by = auth.uid() and o.status = 'open'));

create function respond_to_charge(p_charge_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update extra_charges c
  set status = case when p_accept then 'accepted' else 'rejected' end
  where c.id = p_charge_id
    and c.member_id = auth.uid()
    and c.status = 'pending'
    and exists (select 1 from orders o where o.id = c.order_id and o.status = 'open');
  if not found then raise exception 'charge not found or already answered'; end if;
end $$;

create or replace function close_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from orders
    where id = p_order_id and team_id = my_team_id() and created_by = auth.uid() and status = 'open'
  ) then
    raise exception 'only the person who created this order can close it';
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
  if exists (select 1 from extra_charges where order_id = p_order_id and status <> 'accepted') then
    raise exception 'every extra charge must be accepted or removed before closing';
  end if;
  if (select delivery_charge from orders where id = p_order_id) > 0 and not exists (
    select 1 from order_items i
    join claims c on c.item_id = i.id
    where i.order_id = p_order_id
      and not exists (select 1 from delivery_exclusions x where x.order_id = p_order_id and x.member_id = c.member_id)
  ) then
    raise exception 'at least one person must share the delivery fee';
  end if;
  update orders set status = 'closed' where id = p_order_id;
end $$;

drop view member_month_totals;
drop view order_member_totals;

create view order_member_totals with (security_invoker = on) as
with items as (
  select i.order_id, c.member_id, sum(c.units * i.unit_price) as items_total
  from order_items i
  join claims c on c.item_id = i.id
  group by i.order_id, c.member_id
),
payers as (
  select it.order_id, it.member_id
  from items it
  where not exists (
    select 1 from delivery_exclusions x where x.order_id = it.order_id and x.member_id = it.member_id)
),
payer_counts as (
  select order_id, count(*) as n from payers group by order_id
),
extras as (
  select order_id, member_id, sum(amount) as extras_total
  from extra_charges
  where status = 'accepted'
  group by order_id, member_id
),
people as (
  select order_id, member_id from items
  union
  select order_id, member_id from extras
)
select
  o.id as order_id,
  o.team_id,
  o.ordered_on,
  o.status,
  p.member_id,
  coalesce(it.items_total, 0) as items_total,
  case when py.member_id is not null then o.delivery_charge / pc.n else 0 end as delivery_share,
  coalesce(e.extras_total, 0) as extras_total
from people p
join orders o on o.id = p.order_id
left join items it on it.order_id = p.order_id and it.member_id = p.member_id
left join payers py on py.order_id = p.order_id and py.member_id = p.member_id
left join payer_counts pc on pc.order_id = p.order_id
left join extras e on e.order_id = p.order_id and e.member_id = p.member_id;

create view member_month_totals with (security_invoker = on) as
select
  t.team_id,
  t.member_id,
  m.name as member_name,
  date_trunc('month', t.ordered_on)::date as month,
  sum(t.items_total) as items_total,
  sum(t.delivery_share) as delivery_total,
  sum(t.extras_total) as extras_total,
  sum(t.items_total + t.delivery_share + t.extras_total) as grand_total,
  bool_and(t.status = 'closed') as all_closed,
  s.settled_at
from order_member_totals t
join members m on m.id = t.member_id
left join settlements s on s.member_id = t.member_id and s.month = date_trunc('month', t.ordered_on)::date
group by t.team_id, t.member_id, m.name, date_trunc('month', t.ordered_on), s.settled_at;

create function send_push(p_member_ids uuid[], p_title text, p_body text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', p_title,
    'body', p_body,
    'data', jsonb_build_object('url', p_url),
    'sound', 'default',
    'channelId', 'default',
    'priority', 'high'
  ))
  into v_messages
  from push_tokens t
  where t.member_id = any(p_member_ids);

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
end $$;

revoke execute on function send_push(uuid[], text, text, text) from public, anon, authenticated;

create function rs(p_amount numeric) returns text
language sql immutable as $$
  select 'Rs ' || to_char(round(p_amount), 'FM999,999,999,990')
$$;

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
      'Added by ' || v_creator || '. Tap to claim what you ate.',
      '/order/' || new.id
    );
  end if;
  return new;
end $$;

create function notify_extra_charge() returns trigger
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
end $$;

create trigger extra_charges_notify after insert or update of status on extra_charges
for each row execute function notify_extra_charge();

alter publication supabase_realtime add table extra_charges, delivery_exclusions;
