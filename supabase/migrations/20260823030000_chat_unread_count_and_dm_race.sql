-- Diagnosed two real bugs from a live user report ("messages send slowly,
-- the notification stays"):
--
-- 1) useAuth's unreadChatCount used a single GLOBAL minimum last_read_at
--    across every conversation the user is in, then counted every
--    not-mine message newer than that one threshold - across ALL
--    conversations. One old/abandoned conversation with a stale
--    last_read_at poisons the threshold for every other (already-read)
--    conversation, so the badge never reaches zero. Replaced with a
--    correct per-conversation comparison, done here in one query instead
--    of N+1 round-trips.
--
-- 2) startDM's "does a private conversation with this person already
--    exist?" check was select-then-insert on the client - two
--    near-simultaneous calls (e.g. a double click, or two tabs) can both
--    pass the check before either has committed the insert, creating two
--    separate private conversations for the same pair. This actually
--    happened (found live: two 'private' conversations 400ms apart
--    between the same two users, one an empty orphan). The dedup cleanup
--    in 20260314213906 only ever handled existing duplicates once; it
--    didn't stop new ones. This makes the check-and-create atomic via an
--    advisory lock keyed on the pair, and cleans up the empty orphans
--    that already exist.

create or replace function public.get_unread_chat_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
  where m.sender_id <> auth.uid()
    and coalesce(m.is_deleted, false) = false
    and m.created_at > coalesce(cp.last_read_at, cp.joined_at, 'epoch'::timestamptz);
$$;

revoke execute on function public.get_unread_chat_count() from public, anon;
grant execute on function public.get_unread_chat_count() to authenticated;

create or replace function public.find_or_create_private_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_school_id uuid;
  v_convo_id uuid;
  v_shares_group boolean;
begin
  if v_me is null or p_other_user_id is null or v_me = p_other_user_id then
    raise exception 'Invalid participants';
  end if;

  -- Serialize concurrent calls for this exact pair so two near-simultaneous
  -- requests can't both pass the "does it exist" check before either has
  -- inserted - a plain select-then-insert isn't safe against that race.
  perform pg_advisory_xact_lock(hashtextextended(least(v_me, p_other_user_id)::text || ':' || greatest(v_me, p_other_user_id)::text, 0));

  select c.id into v_convo_id
  from public.conversations c
  where c.type = 'private'
    and exists (select 1 from public.conversation_participants cp1 where cp1.conversation_id = c.id and cp1.user_id = v_me)
    and exists (select 1 from public.conversation_participants cp2 where cp2.conversation_id = c.id and cp2.user_id = p_other_user_id)
  order by c.updated_at desc
  limit 1;

  if v_convo_id is not null then
    return v_convo_id;
  end if;

  select exists (
    select 1 from public.conversations c2
    where c2.type <> 'private'
      and exists (select 1 from public.conversation_participants x1 where x1.conversation_id = c2.id and x1.user_id = v_me)
      and exists (select 1 from public.conversation_participants x2 where x2.conversation_id = c2.id and x2.user_id = p_other_user_id)
  ) into v_shares_group;

  select school_id into v_school_id from public.profiles where id = v_me;
  if v_school_id is null then
    select id into v_school_id from public.schools limit 1;
  end if;

  insert into public.conversations (school_id, type, created_by, is_accepted)
  values (v_school_id, 'private', v_me, coalesce(v_shares_group, false))
  returning id into v_convo_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_convo_id, v_me), (v_convo_id, p_other_user_id);

  return v_convo_id;
end;
$$;

revoke execute on function public.find_or_create_private_conversation(uuid) from public, anon;
grant execute on function public.find_or_create_private_conversation(uuid) to authenticated;

-- One-time cleanup: remove empty (zero-message) private conversations that
-- duplicate another private conversation with the exact same participants.
-- Never touches a conversation that has any real messages.
delete from public.conversations c
where c.type = 'private'
  and not exists (select 1 from public.messages m where m.conversation_id = c.id)
  and exists (
    select 1
    from public.conversations c2
    where c2.id <> c.id
      and c2.type = 'private'
      and (select array_agg(user_id order by user_id) from public.conversation_participants where conversation_id = c.id)
        = (select array_agg(user_id order by user_id) from public.conversation_participants where conversation_id = c2.id)
  );
