create extension if not exists pg_net with schema extensions;

create table push_tokens (
  token text primary key,
  member_id uuid not null references members(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table push_tokens enable row level security;

create function register_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token not like 'ExponentPushToken[%]' then raise exception 'not an Expo push token'; end if;
  if not exists (select 1 from members where id = auth.uid()) then raise exception 'join a team first'; end if;
  insert into push_tokens (token, member_id) values (p_token, auth.uid())
  on conflict (token) do update set member_id = excluded.member_id, updated_at = now();
end $$;

create function notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_creator text;
  v_messages jsonb;
begin
  select name into v_creator from members where id = new.created_by;

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', 'New lunch order',
    'body', v_creator || ' added ' || coalesce('an order from ' || nullif(new.title, ''), 'an order')
            || '. Tap to claim what you ate.',
    'data', jsonb_build_object('url', '/order/' || new.id),
    'sound', 'default',
    'channelId', 'default',
    'priority', 'high'
  ))
  into v_messages
  from push_tokens t
  join members m on m.id = t.member_id
  where m.team_id = new.team_id
    and m.id <> new.created_by;

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
end $$;

create trigger orders_notify after insert on orders
for each row execute function notify_new_order();

