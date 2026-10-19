-- Security hardening after the 2026-10-19 code review.
--
-- 1. Anyone could insert ANY role for themselves ("Users can insert own
--    roles"), including system_admin. Self-registration may now only request
--    the registration roles, and only while the account is unapproved.
-- 2. Users could update their own profile freely: set is_approved, or move to
--    another school and read its data. A trigger blocks both, and roles /
--    school scope only take effect once the account is approved.
-- 3. Anyone could link themselves as the parent of any student. Links are now
--    made by link_my_child (child's ID number + name must match), and a link
--    only grants access once the parent is approved.
-- 4. Chat moderation ran only in the client. chat-moderate now signs its
--    verdict and a trigger rejects messages without a valid signature.
-- 5. find_student_by_id_number told anonymous callers a student's name.
-- 6. Badges and streaks could be written for any user.
-- 7. One query for the chat list's last message + unread count, instead of
--    downloading every message.

-- ── 1+2. Roles and school scope require an approved account ─────────────
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id
      and p.is_approved
      and (ur.role = _role or (ur.role = 'super_admin'::app_role and _role = 'system_admin'::app_role))
  )
$$;

create or replace function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid() and is_approved
$$;

drop policy if exists "Users can insert own roles" on public.user_roles;
drop policy if exists "Users can request registration roles" on public.user_roles;
create policy "Users can request registration roles" on public.user_roles
for insert to authenticated
with check (
  user_id = auth.uid()
  and role in ('student', 'parent', 'educator', 'professional_teacher', 'subject_coordinator', 'grade_coordinator', 'counselor', 'management')
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_approved)
);

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role, SQL and other users (approvers, admins) are not limited here.
  if auth.uid() is null or auth.uid() <> NEW.id then
    return NEW;
  end if;
  if NEW.is_approved is distinct from OLD.is_approved then
    raise exception 'You cannot change your own approval';
  end if;
  if OLD.is_approved and (NEW.school_id is distinct from OLD.school_id or NEW.class_id is distinct from OLD.class_id) then
    raise exception 'Your school and class are changed by the school';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_profile_self_update on public.profiles;
create trigger trg_guard_profile_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();

-- Teachers pick their classes at registration; afterwards classes are
-- assigned by coordinators (an approved teacher could otherwise add
-- themselves to any class and read its students).
drop policy if exists "Users can insert own teacher classes" on public.teacher_classes;
create policy "Users can insert own teacher classes" on public.teacher_classes
for insert to authenticated
with check (
  user_id = auth.uid()
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_approved)
);

-- Approvers must hold the role on an approved account.
drop policy if exists "Approvers can view pending approvals" on public.approvals;
create policy "Approvers can view pending approvals" on public.approvals
for select
using (has_role(auth.uid(), approvals.required_role) and public.can_approve(auth.uid(), approvals.required_role, approvals.user_id));

drop policy if exists "Approvers can update approvals" on public.approvals;
create policy "Approvers can update approvals" on public.approvals
for update
using (has_role(auth.uid(), approvals.required_role) and public.can_approve(auth.uid(), approvals.required_role, approvals.user_id));

-- ── 3. Parent links ──────────────────────────────────────────────────────
drop policy if exists "Parents can insert links" on public.parent_student;

-- Policies elsewhere check "exists (select from parent_student ...)", which
-- runs under this table's RLS - so an unapproved parent's link grants nothing.
drop policy if exists "Users can view own parent-student links" on public.parent_student;
create policy "Users can view own parent-student links" on public.parent_student
for select to authenticated
using (
  auth.uid() = student_id
  or (auth.uid() = parent_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_approved))
  or has_role(auth.uid(), 'system_admin'::app_role)
);

-- Matches a child by ID number AND name (first name must appear in the full name).
create or replace function public.match_child(p_id_number text, p_child_name text, p_school_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
  v_hash text;
  v_first text := lower(split_part(btrim(coalesce(p_child_name, '')), ' ', 1));
  v_id uuid;
begin
  if coalesce(btrim(p_id_number), '') = '' or length(v_first) < 2 then
    return null;
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
  v_hash := encode(hmac(btrim(p_id_number), v_key, 'sha256'), 'hex');
  select p.id into v_id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'student'
  where p.school_id = p_school_id
    and p.id_number_hash = v_hash
    and position(v_first in lower(p.full_name)) > 0
  limit 1;
  return v_id;
end;
$$;
revoke execute on function public.match_child(text, text, uuid) from public, anon, authenticated;

-- Registration form check: yes/no only, never the child's name.
create or replace function public.check_child_registration(p_id_number text, p_child_name text, p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.match_child(p_id_number, p_child_name, p_school_id) is not null
$$;
revoke execute on function public.check_child_registration(text, text, uuid) from public;
grant execute on function public.check_child_registration(text, text, uuid) to anon, authenticated;

-- Called by the parent right after sign-up, before approval.
create or replace function public.link_my_child(p_id_number text, p_child_name text, p_school_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_approved) then
    raise exception 'Approved parents add children through the school';
  end if;
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'parent') then
    raise exception 'Only parents can link a child';
  end if;
  v_child := public.match_child(p_id_number, p_child_name, p_school_id);
  if v_child is null then return false; end if;
  insert into public.parent_student (parent_id, student_id) values (auth.uid(), v_child) on conflict do nothing;
  return true;
end;
$$;
revoke execute on function public.link_my_child(text, text, uuid) from public, anon;
grant execute on function public.link_my_child(text, text, uuid) to authenticated;

-- ── 5. No name lookup by ID number for anonymous callers ────────────────
revoke execute on function public.find_student_by_id_number(text, uuid) from public, anon, authenticated;

-- ── 4. Server-side chat moderation ───────────────────────────────────────
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'chat_moderation_key',
  'Signs chat-moderate verdicts so the database only accepts moderated messages'
) where not exists (select 1 from vault.secrets where name = 'chat_moderation_key');

alter table public.messages add column if not exists moderation_token text;
alter table public.scheduled_chat_messages add column if not exists moderation_token text;

create or replace function public.chat_moderation_token(p_sender uuid, p_conversation uuid, p_content text, p_flagged boolean)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'chat_moderation_key' limit 1;
  return encode(hmac(p_sender::text || '|' || p_conversation::text || '|' || coalesce(p_content, '') || '|' || coalesce(p_flagged, false)::text, v_key, 'sha256'), 'hex');
end;
$$;
-- Only chat-moderate (service role) signs.
revoke execute on function public.chat_moderation_token(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.chat_moderation_token(uuid, uuid, text, boolean) to service_role;

create or replace function public.enforce_chat_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-side writers (service role, cron) are trusted.
  if auth.uid() is null then
    NEW.moderation_token := null;
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.content is not distinct from OLD.content and NEW.is_flagged is not distinct from OLD.is_flagged then
    NEW.moderation_token := null;
    return NEW;
  end if;
  -- Staff may clear or set a flag without rewriting the message.
  if TG_OP = 'UPDATE' and NEW.content is not distinct from OLD.content
     and exists (select 1 from public.user_roles where user_id = auth.uid() and role not in ('student', 'parent'))
     and public.current_user_school_id() is not null then
    NEW.moderation_token := null;
    return NEW;
  end if;
  -- An attachment with no text has nothing to moderate.
  if btrim(coalesce(NEW.content, '')) = '' and not coalesce(NEW.is_flagged, false) then
    NEW.moderation_token := null;
    return NEW;
  end if;
  if NEW.moderation_token is null
     or NEW.moderation_token <> public.chat_moderation_token(NEW.sender_id, NEW.conversation_id, NEW.content, coalesce(NEW.is_flagged, false)) then
    raise exception 'The message was not checked by moderation' using errcode = '42501';
  end if;
  -- messages keep no token; scheduled rows keep it for delivery.
  if TG_TABLE_NAME = 'messages' then
    NEW.moderation_token := null;
  end if;
  return NEW;
end;
$$;

-- The triggers that enforce this are in 20261019010000_enforce_chat_moderation.sql,
-- applied once clients that send the token are deployed.

-- Delivery carries the token checked at scheduling time.
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
    select id, conversation_id, content, is_flagged, flag_reason, moderation_token
    from public.scheduled_chat_messages
    where sender_id = auth.uid()
      and sent_at is null
      and send_at <= now()
    order by send_at
    limit 50
  loop
    insert into public.messages (conversation_id, sender_id, content, is_flagged, flag_reason, moderation_token)
    values (v_row.conversation_id, auth.uid(), v_row.content, coalesce(v_row.is_flagged, false), v_row.flag_reason, v_row.moderation_token);

    update public.scheduled_chat_messages set sent_at = now() where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── 6. Badges and streaks only for yourself ─────────────────────────────
create or replace function public.update_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record user_streaks%rowtype;
  v_today date := current_date;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  select * into v_record from user_streaks where user_id = p_user_id;
  if not found then
    insert into user_streaks (user_id, current_streak, longest_streak, last_active_date, total_active_days)
    values (p_user_id, 1, 1, v_today, 1);
    return;
  end if;
  if v_record.last_active_date = v_today then
    return;
  end if;
  if v_record.last_active_date = v_today - 1 then
    update user_streaks set
      current_streak = current_streak + 1,
      longest_streak = greatest(longest_streak, current_streak + 1),
      last_active_date = v_today,
      total_active_days = total_active_days + 1,
      updated_at = now()
    where user_id = p_user_id;
  else
    update user_streaks set
      current_streak = 1,
      last_active_date = v_today,
      total_active_days = total_active_days + 1,
      updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.check_and_award_badge(p_user_id uuid, p_badge_key text, p_badge_label text, p_badge_icon text, p_category text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  insert into user_badges (user_id, badge_key, badge_label, badge_icon, badge_category)
  values (p_user_id, p_badge_key, p_badge_label, p_badge_icon, p_category)
  on conflict (user_id, badge_key) do nothing;
  return found;
end;
$$;

-- ── 7. Chat list summaries ───────────────────────────────────────────────
create or replace function public.get_my_conversation_summaries()
returns table (
  conversation_id uuid,
  last_content text,
  last_created_at timestamptz,
  last_is_flagged boolean,
  last_is_deleted boolean,
  unread_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select cp.conversation_id,
         lm.content,
         lm.created_at,
         coalesce(lm.is_flagged, false),
         coalesce(lm.is_deleted, false),
         (select count(*)::int from public.messages m
           where m.conversation_id = cp.conversation_id
             and m.sender_id <> auth.uid()
             and cp.last_read_at is not null
             and m.created_at > cp.last_read_at)
  from public.conversation_participants cp
  left join lateral (
    select m.content, m.created_at, m.is_flagged, m.is_deleted
    from public.messages m
    where m.conversation_id = cp.conversation_id
    order by m.created_at desc
    limit 1
  ) lm on true
  where cp.user_id = auth.uid()
$$;
revoke execute on function public.get_my_conversation_summaries() from public, anon;
grant execute on function public.get_my_conversation_summaries() to authenticated;

create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at desc);
