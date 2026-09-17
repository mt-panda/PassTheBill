begin;

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  tm teams;
  o uuid;
  biryani uuid;
  naan uuid;
  r record;
begin
  insert into auth.users (id, aud, role) values (u1, 'authenticated', 'authenticated'),
    (u2, 'authenticated', 'authenticated'), (u3, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claims', json_build_object('sub', u1)::text, true);
  tm := create_team('Test', 'Ali');
  insert into members (id, team_id, name) values (u2, tm.id, 'Sara'), (u3, tm.id, 'Omar');

  insert into orders (team_id, created_by, delivery_charge) values (tm.id, u1, 150) returning id into o;
  insert into order_items (order_id, name, unit_price, qty) values (o, 'Biryani', 350, 2) returning id into biryani;
  insert into order_items (order_id, name, unit_price, qty) values (o, 'Naan', 50, 4) returning id into naan;

  insert into claims (item_id, member_id, units) values (biryani, u1, 1), (biryani, u2, 1), (naan, u1, 1);

  begin
    insert into claims (item_id, member_id, units) values (biryani, u3, 1);
    raise exception 'FAIL: over-claim allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  begin
    perform close_order(o);
    raise exception 'FAIL: closed with unclaimed units';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  insert into claims (item_id, member_id, units) values (naan, u3, 3);
  perform close_order(o);

  for r in select member_name, grand_total, all_closed from member_month_totals where team_id = tm.id loop
    if not r.all_closed then raise exception 'FAIL: % not closed', r.member_name; end if;
    if (r.member_name, r.grand_total) not in (('Ali', 450.00), ('Sara', 400.00), ('Omar', 200.00)) then
      raise exception 'FAIL: % got %', r.member_name, r.grand_total;
    end if;
  end loop;
  if (select sum(grand_total) from member_month_totals where team_id = tm.id) <> 1050 then
    raise exception 'FAIL: totals do not sum to bill + delivery';
  end if;

  raise notice 'check passed';
end $$;

rollback;
