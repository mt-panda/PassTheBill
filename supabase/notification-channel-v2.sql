-- Custom notification sound on Android.
-- Android fixes a channel's sound when the channel is first created. Every install so far created
-- 'pass-the-bill' before the sound was bundled, so it plays the default sound forever. Builds that
-- bundle the sound (android.versionCode >= 2) create 'pass-the-bill-v2' and register their token
-- for it; older builds keep 'pass-the-bill'. Additive: safe to run before or after the app update.
-- Run once in the Supabase SQL Editor.

alter table push_tokens add column if not exists channel_id text not null default 'pass-the-bill';

-- New overload; the one-argument register_push_token(p_token) stays for older builds.
create or replace function register_push_token(p_token text, p_channel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token not like 'ExponentPushToken[%]' then raise exception 'not an Expo push token'; end if;
  if p_channel not in ('pass-the-bill', 'pass-the-bill-v2') then raise exception 'unknown notification channel'; end if;
  if not exists (select 1 from members where id = auth.uid()) then raise exception 'join a team first'; end if;
  insert into push_tokens (token, member_id, channel_id) values (p_token, auth.uid(), p_channel)
  on conflict (token) do update set member_id = excluded.member_id, channel_id = excluded.channel_id, updated_at = now();
end $$;

revoke execute on function register_push_token(text, text) from public, anon;
grant execute on function register_push_token(text, text) to authenticated;

-- Same as live, except the channel now comes from the token.
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
    'channelId', t.channel_id,
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

-- Rollback (if ever needed):
--   drop function if exists register_push_token(text, text);
--   then re-run send_push from supabase/notification-sound.sql ('channelId', 'pass-the-bill');
--   alter table push_tokens drop column if exists channel_id;
