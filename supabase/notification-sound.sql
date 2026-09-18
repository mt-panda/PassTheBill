-- PassTheBill notification sound/channel migration
-- Run this once in Supabase SQL Editor.

create or replace function send_push(p_member_ids uuid[], p_title text, p_body text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', p_title,
    'body', p_body,
    'data', jsonb_build_object('url', p_url),
    'sound', 'ptb_notification.wav',
    'channelId', 'pass-the-bill',
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

-- Ensure new-order notifications use the same custom channel/sound through send_push.
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
