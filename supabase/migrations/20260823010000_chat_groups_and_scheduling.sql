-- ChatPage already had full display scaffolding for a "group" conversation
-- type (icon, "קבוצות" section header) and a scheduled_chat_messages outbox
-- table (20260404120000), but neither was ever wired up: there was no way
-- for a user to actually create a group, and the chat page's own help text
-- literally listed "תזמון הודעות" as still "בשלבי הרחבה" (in progress).
-- Group creation itself needs no new backend - conversation_participants
-- already lets a conversation's creator add other participants (see
-- "Conversation creator can add participants", 20260314211642), so that's
-- a frontend-only addition. Scheduled messages need a delivery mechanism.
--
-- There's still no pg_cron in this project (see missing_exam_material_
-- reminder's comment), so - same reasoning as that feature - delivery is a
-- SECURITY DEFINER function the client calls opportunistically (on chat
-- load, on an interval while chat is open, and best-effort on every auth
-- refresh app-wide) rather than a true background job. A message scheduled
-- while the sender never reopens the app won't send; that's an accepted
-- limits-of-the-infra tradeoff, not a bug.

-- Scheduled messages need the same moderation fields real messages get
-- (chat-moderate is called client-side at *schedule* time, since a plpgsql
-- function can't reach the moderation edge function at delivery time) so
-- flags/reasons survive into the real message row when delivered.
alter table public.scheduled_chat_messages
  add column if not exists is_flagged boolean default false,
  add column if not exists flag_reason text;

-- Tighten: the original policy only checked sender_id, so a user could
-- schedule a message insert into ANY conversation_id, participant or not.
drop policy if exists "Users manage own scheduled chat messages" on public.scheduled_chat_messages;
create policy "Users manage own scheduled chat messages" on public.scheduled_chat_messages
  for all using (auth.uid() = sender_id)
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = scheduled_chat_messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create or replace function public.process_due_scheduled_messages()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  for v_row in
    select id, conversation_id, content, is_flagged, flag_reason
    from public.scheduled_chat_messages
    where sender_id = auth.uid()
      and sent_at is null
      and send_at <= now()
    order by send_at
    limit 50
  loop
    insert into public.messages (conversation_id, sender_id, content, is_flagged, flag_reason)
    values (v_row.conversation_id, auth.uid(), v_row.content, coalesce(v_row.is_flagged, false), v_row.flag_reason);

    update public.scheduled_chat_messages set sent_at = now() where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.process_due_scheduled_messages() from public, anon;
grant execute on function public.process_due_scheduled_messages() to authenticated;
