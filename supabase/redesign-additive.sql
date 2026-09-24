-- PassTheBill redesign: additive SQL. Safe for the currently shipped app (it never calls the new
-- functions; the claim lock and FK change are invisible to it). Idempotent: re-running is fine.
-- Run once in the Supabase SQL Editor.

-- 1. Create or edit an order and its items in ONE transaction (fixes half-saved edits and the
--    new-order push arriving before its items). security invoker: RLS applies exactly as for
--    today's direct writes; the explicit checks below also hold when run as postgres.
create or replace function save_order(
  p_order_id uuid default null,
  p_title text default '',
  p_ordered_on date default null,
  p_delivery numeric default 0,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_title text := coalesce(trim(p_title), '');
  v_keep uuid[];
  v_item uuid;
  v_item_ids uuid[] := '{}';
  e jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'save_order: no items';
  end if;
  if length(v_title) > 80 then raise exception 'save_order: title too long'; end if;

  if p_order_id is null then
    insert into orders (team_id, created_by, title, ordered_on, delivery_charge)
    values (my_team_id(), auth.uid(), v_title, coalesce(p_ordered_on, current_date), coalesce(p_delivery, 0))
    returning id into v_id;
  else
    update orders
    set title = v_title,
        ordered_on = coalesce(p_ordered_on, ordered_on),
        delivery_charge = coalesce(p_delivery, 0)
    where id = p_order_id and created_by = auth.uid() and status = 'open'
    returning id into v_id;
    if v_id is null then raise exception 'save_order: order not editable'; end if;

    -- Delete removed items FIRST, with a NULL-safe keep list (new items have no id).
    select coalesce(array_agg((x->>'id')::uuid) filter (where x->>'id' is not null), '{}')
      into v_keep
      from jsonb_array_elements(p_items) x;
    delete from order_items where order_id = v_id and id <> all(v_keep);
  end if;

  for e in select t.value from jsonb_array_elements(p_items) with ordinality t(value, ord) order by t.ord loop
    v_item := null;
    if e->>'id' is not null then
      update order_items
      set name = trim(e->>'name'),
          unit_price = (e->>'unit_price')::numeric,
          qty = (e->>'qty')::int,
          -- key absent = keep the stored picture; null = clear it (rename); string = set it.
          image_url = case when e ? 'image_url' then e->>'image_url' else image_url end
      where id = (e->>'id')::uuid and order_id = v_id
      returning id into v_item;
      if v_item is null then raise exception 'save_order: item not found'; end if;
    else
      insert into order_items (order_id, name, unit_price, qty, image_url)
      values (v_id, trim(e->>'name'), (e->>'unit_price')::numeric, (e->>'qty')::int, e->>'image_url')
      returning id into v_item;
    end if;
    v_item_ids := v_item_ids || v_item;
  end loop;

  -- item_ids[i] belongs to p_items[i], so the app can attach late food pictures.
  return jsonb_build_object('order_id', v_id, 'item_ids', to_jsonb(v_item_ids));
end $$;

-- 2. Sign-out removes this device's push token.
create or replace function unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and member_id = auth.uid();
$$;

-- 3. A teammate can take over an open order whose creator left the team (otherwise it can never
--    be closed, edited or deleted).
create or replace function adopt_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders o
  set created_by = auth.uid()
  where o.id = p_order_id
    and o.status = 'open'
    and o.team_id = my_team_id()
    and not exists (select 1 from members m where m.id = o.created_by and m.team_id = o.team_id);
  if not found then raise exception 'adopt_order: not allowed'; end if;
end $$;

-- 4. Pick vs quantity-edit race: lock the item row so both can't commit past the limit.
--    Same as the live definition except `for update`; message unchanged.
create or replace function check_claim_units() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qty int; v_taken int;
begin
  select qty into v_qty from order_items where id = new.item_id for update;
  select coalesce(sum(units), 0) into v_taken from claims where item_id = new.item_id and id <> new.id;
  if v_taken + new.units > v_qty then
    raise exception 'only % unit(s) left', v_qty - v_taken;
  end if;
  return new;
end $$;

-- 5. Deleting a review starter's account must not delete their reviews (which would re-bill those
--    orders). cascade -> set null.
alter table billing_cycles alter column triggered_by drop not null;
do $$
declare c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
  where con.conrelid = 'billing_cycles'::regclass and con.contype = 'f' and a.attname = 'triggered_by';
  if c is not null then execute format('alter table billing_cycles drop constraint %I', c); end if;
end $$;
alter table billing_cycles
  add constraint billing_cycles_triggered_by_fkey
  foreign key (triggered_by) references members(id) on delete set null;

-- 6. Repo/schema parity (already exists in production).
alter table order_items add column if not exists image_url text;

notify pgrst, 'reload schema';
