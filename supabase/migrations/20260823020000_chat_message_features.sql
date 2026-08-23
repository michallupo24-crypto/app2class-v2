-- Chat feature round-up: mute (already had the column, just needed the
-- RLS it turns out already permits - see notes below), edit/delete,
-- read receipts (uses existing conversation_participants.last_read_at -
-- no schema change), reply-to, @mentions, and attachments. Typing
-- indicators and in-conversation search are frontend-only (Realtime
-- broadcast and client-side filtering respectively) and need nothing here.
--
-- Mute: conversation_participants already has `muted` and an UPDATE policy
-- ("Users can update own participation", USING auth.uid() = user_id) that
-- already permits a participant to flip their own `muted` flag - and
-- notify_new_message already reads it. So mute needed zero DB changes,
-- only a client-side toggle - noted here so it's not a mystery why this
-- migration doesn't touch it.

alter table public.messages
  add column if not exists is_deleted boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists mentioned_user_ids uuid[] not null default '{}';

-- Sender can edit content / set edited_at / soft-delete their own message.
-- There was no UPDATE policy on messages at all before this.
create policy "Sender can edit own message" on public.messages
  for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- Leave a conversation (delete own row) or, if you created it, remove
-- someone else. There was no DELETE policy on conversation_participants
-- at all before this.
create policy "Leave or remove from conversation" on public.conversation_participants
  for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id and c.created_by = auth.uid()
    )
  );

-- Extend the existing new-message notification (20260823000000) to call
-- out an @mention distinctly instead of (or as well as) the generic
-- "new message" - mentioned_user_ids is populated client-side from the
-- mention picker, not parsed from raw text server-side, so this is exact,
-- not a fuzzy name match.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_sender_name text;
  v_link text;
begin
  select school_id into v_school_id from public.conversations where id = NEW.conversation_id;
  select full_name into v_sender_name from public.profiles where id = NEW.sender_id;
  v_link := '/dashboard/chat?conversation=' || NEW.conversation_id::text;

  insert into public.notifications (user_id, school_id, type, title, body, link)
  select
    cp.user_id, v_school_id,
    case when cp.user_id = any(NEW.mentioned_user_ids) then 'chat_mention' else 'new_message' end,
    case when cp.user_id = any(NEW.mentioned_user_ids)
      then coalesce(v_sender_name, 'מישהו') || ' אזכר/ה אותך'
      else coalesce(v_sender_name, 'הודעה חדשה') end,
    left(NEW.content, 200), v_link
  from public.conversation_participants cp
  where cp.conversation_id = NEW.conversation_id
    and cp.user_id <> NEW.sender_id
    and coalesce(cp.muted, false) = false;

  return NEW;
end;
$$;

-- Private attachment storage: 'lesson-files' (used everywhere else) is a
-- PUBLIC bucket, wrong for chat given one conversation type is literally
-- 'counseling' - anyone with a guessed/leaked URL could read a counseling
-- attachment. This bucket is private; objects live under
-- <conversation_id>/<filename> and RLS reuses is_conversation_participant
-- (already SECURITY DEFINER, already used by the conversations UPDATE
-- policy) so only that conversation's participants can read or upload.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

create policy "Chat participants can view attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

create policy "Chat participants can upload attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
);
