-- Automatic chat groups: one homeroom group per class, one group per
-- class x subject (students + the teachers who teach it), and staff teams
-- (homeroom teachers of a grade with its coordinator, teachers of a subject
-- with its coordinator). Groups are keyed by auto_key so syncing is
-- idempotent; membership follows the school's current data.

alter table public.conversations
  add column if not exists auto_key text,
  add column if not exists icon_subject text;

create unique index if not exists conversations_auto_key_uq
  on public.conversations (auto_key) where auto_key is not null;

comment on column public.conversations.auto_key is
  'Set for system-managed groups (class:<id>, subj:<class>:<subject>, team:homeroom:<school>:<grade>, team:subject:<school>:<subject>).';
comment on column public.conversations.icon_subject is
  'Sticker subject shown as the group logo; teachers in the group can change it.';

-- staff_team joins the channel types. NOT VALID so legacy rows with older
-- type names don't block the migration.
alter table public.conversations drop constraint if exists conversations_type_check;
alter table public.conversations add constraint conversations_type_check check (
  type in (
    'private', 'group', 'class_subject', 'class_homeroom', 'counseling', 'parent_teacher',
    'class_parent_group', 'grade_parent_group', 'staff_team',
    'direct', 'class', 'grade', 'subject', 'announcement', 'parent_class', 'parent_grade'
  )
) not valid;

alter table public.schools add column if not exists chat_groups_synced_at timestamptz;

create or replace function public.sync_school_chat_groups(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := public.current_user_school_id();
  v_last timestamptz;
  v_created integer := 0;
begin
  if v_school is null then return 0; end if;

  -- Every chat page load calls this; once every two minutes per school is plenty.
  select chat_groups_synced_at into v_last from public.schools where id = v_school for update;
  if not p_force and v_last is not null and v_last > now() - interval '2 minutes' then
    return 0;
  end if;
  update public.schools set chat_groups_synced_at = now() where id = v_school;

  create temp table if not exists _chat_want (
    auto_key text, type text, title text, subject text, class_id uuid, grade text,
    member uuid, is_staff boolean
  ) on commit drop;
  truncate _chat_want;

  -- Building blocks
  create temp table if not exists _chat_students (class_id uuid, user_id uuid) on commit drop;
  create temp table if not exists _chat_homeroom (class_id uuid, user_id uuid) on commit drop;
  create temp table if not exists _chat_subject_teacher (class_id uuid, subject text, user_id uuid) on commit drop;
  truncate _chat_students; truncate _chat_homeroom; truncate _chat_subject_teacher;

  insert into _chat_students
  select distinct p.class_id, p.id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'student'
  where p.school_id = v_school and p.class_id is not null and p.is_approved;

  insert into _chat_homeroom
  select tc.class_id, tc.user_id
  from public.teacher_classes tc join public.classes c on c.id = tc.class_id
  where c.school_id = v_school and coalesce(tc.is_homeroom, false)
  union
  select ur.homeroom_class_id, ur.user_id
  from public.user_roles ur join public.classes c on c.id = ur.homeroom_class_id
  where ur.role = 'educator' and c.school_id = v_school;

  insert into _chat_subject_teacher
  select ts.class_id, btrim(ts.subject), ts.teacher_id
  from public.timetable_slots ts
  where ts.school_id = v_school and ts.class_id is not null and ts.teacher_id is not null
    and btrim(ts.subject) <> '' and btrim(ts.subject) not in ('חינוך', 'שעת חינוך')
  union
  select tc.class_id, btrim(ur.subject), tc.user_id
  from public.teacher_classes tc
  join public.classes c on c.id = tc.class_id
  join public.user_roles ur on ur.user_id = tc.user_id
    and ur.role in ('professional_teacher', 'subject_coordinator') and coalesce(btrim(ur.subject), '') <> ''
  where c.school_id = v_school and not coalesce(tc.is_homeroom, false);

  -- 1) Class group: students + homeroom teachers
  insert into _chat_want
  select 'class:' || c.id, 'class_homeroom', 'כיתה ' || c.grade::text || '-' || c.class_number,
         null::text, c.id, c.grade::text, m.user_id, m.is_staff
  from public.classes c
  join (
    select class_id, user_id, false as is_staff from _chat_students
    union select class_id, user_id, true from _chat_homeroom
  ) m on m.class_id = c.id
  where c.school_id = v_school;

  -- 2) Class x subject: students + the subject's teachers in that class
  insert into _chat_want
  select 'subj:' || st.class_id || ':' || st.subject, 'class_subject', st.subject || ' · ' || c.grade::text || '-' || c.class_number,
         st.subject, st.class_id, c.grade::text, m.user_id, m.is_staff
  from (select distinct class_id, subject from _chat_subject_teacher) st
  join public.classes c on c.id = st.class_id
  join (
    select s.class_id, null::text as subject, s.user_id, false as is_staff from _chat_students s
    union select t.class_id, t.subject, t.user_id, true from _chat_subject_teacher t
  ) m on m.class_id = st.class_id and (m.subject is null or m.subject = st.subject);

  -- 3) Grade homeroom team: the grade's homeroom teachers + grade coordinators
  insert into _chat_want
  select 'team:homeroom:' || v_school || ':' || c.grade::text, 'staff_team', 'מחנכי שכבה ' || c.grade::text,
         null::text, null::uuid, c.grade::text, h.user_id, true
  from _chat_homeroom h join public.classes c on c.id = h.class_id
  union
  select 'team:homeroom:' || v_school || ':' || ur.grade::text, 'staff_team', 'מחנכי שכבה ' || ur.grade::text,
         null::text, null::uuid, ur.grade::text, ur.user_id, true
  from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.role = 'grade_coordinator' and ur.grade is not null and p.school_id = v_school
    and exists (select 1 from _chat_homeroom h join public.classes c on c.id = h.class_id where c.grade = ur.grade);

  -- 4) Subject team: the subject's teachers + subject coordinators
  insert into _chat_want
  select 'team:subject:' || v_school || ':' || t.subject, 'staff_team', 'צוות ' || t.subject,
         t.subject, null::uuid, null::text, t.user_id, true
  from (select distinct subject, user_id from _chat_subject_teacher) t
  union
  select 'team:subject:' || v_school || ':' || btrim(ur.subject), 'staff_team', 'צוות ' || btrim(ur.subject),
         btrim(ur.subject), null::uuid, null::text, ur.user_id, true
  from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.role = 'subject_coordinator' and coalesce(btrim(ur.subject), '') <> '' and p.school_id = v_school
    and exists (select 1 from _chat_subject_teacher t where t.subject = btrim(ur.subject));

  -- A staff team of one person is not a team.
  delete from _chat_want w
  where w.type = 'staff_team'
    and (select count(distinct member) from _chat_want x where x.auto_key = w.auto_key) < 2;

  -- Create missing groups (each needs a staff member as its owner).
  with owners as (
    select distinct on (auto_key) auto_key, type, title, subject, class_id, grade, member
    from _chat_want where is_staff
    order by auto_key, member
  ), ins as (
    insert into public.conversations (school_id, type, title, subject, class_id, grade, auto_key, icon_subject, created_by, is_accepted)
    select v_school, o.type, o.title, o.subject, o.class_id, o.grade, o.auto_key, o.subject, o.member, true
    from owners o
    on conflict (auto_key) where auto_key is not null do update set title = excluded.title
      where public.conversations.title is distinct from excluded.title
    returning 1
  )
  select count(*) into v_created from ins;

  insert into public.conversation_participants (conversation_id, user_id)
  select distinct c.id, w.member
  from _chat_want w join public.conversations c on c.auto_key = w.auto_key
  on conflict (conversation_id, user_id) do nothing;

  -- Members who left the class / stopped teaching the subject leave the group.
  delete from public.conversation_participants cp
  using public.conversations c
  where cp.conversation_id = c.id
    and c.school_id = v_school
    and c.auto_key is not null
    and not exists (select 1 from _chat_want w where w.auto_key = c.auto_key and w.member = cp.user_id);

  return v_created;
end;
$$;

revoke execute on function public.sync_school_chat_groups(boolean) from public, anon;
grant execute on function public.sync_school_chat_groups(boolean) to authenticated;

-- Teachers (any non-student, non-parent member) can change a group's logo.
create or replace function public.set_chat_group_icon(p_conversation_id uuid, p_icon_subject text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role not in ('student', 'parent')
  ) then
    raise exception 'only staff can change the group logo';
  end if;
  update public.conversations
  set icon_subject = nullif(btrim(p_icon_subject), '')
  where id = p_conversation_id and type <> 'private';
end;
$$;

revoke execute on function public.set_chat_group_icon(uuid, text) from public, anon;
grant execute on function public.set_chat_group_icon(uuid, text) to authenticated;

-- The teachers of my class (or my children's classes, for parents), to
-- message them directly.
create or replace function public.get_my_class_teachers()
returns table (user_id uuid, full_name text, subjects text[], is_homeroom boolean, class_label text)
language sql
stable
security definer
set search_path = public
as $$
  with my_classes as (
    select p.class_id from public.profiles p where p.id = auth.uid() and p.class_id is not null
    union
    select p.class_id from public.parent_student ps join public.profiles p on p.id = ps.student_id
    where ps.parent_id = auth.uid() and p.class_id is not null
  ), t as (
    select ts.class_id, ts.teacher_id as user_id, btrim(ts.subject) as subject, false as is_homeroom
    from public.timetable_slots ts
    where ts.class_id in (select class_id from my_classes) and ts.teacher_id is not null
    union
    select tc.class_id, tc.user_id, btrim(ur.subject), false
    from public.teacher_classes tc
    join public.user_roles ur on ur.user_id = tc.user_id
      and ur.role in ('professional_teacher', 'subject_coordinator') and coalesce(btrim(ur.subject), '') <> ''
    where tc.class_id in (select class_id from my_classes) and not coalesce(tc.is_homeroom, false)
    union
    select tc.class_id, tc.user_id, null, true
    from public.teacher_classes tc
    where tc.class_id in (select class_id from my_classes) and coalesce(tc.is_homeroom, false)
    union
    select ur.homeroom_class_id, ur.user_id, null, true
    from public.user_roles ur
    where ur.role = 'educator' and ur.homeroom_class_id in (select class_id from my_classes)
  )
  select t.user_id,
         pr.full_name,
         array_remove(array_agg(distinct t.subject), null),
         bool_or(t.is_homeroom),
         min(c.grade::text || '-' || c.class_number)
  from t
  join public.profiles pr on pr.id = t.user_id
  join public.classes c on c.id = t.class_id
  group by t.user_id, pr.full_name
  order by bool_or(t.is_homeroom) desc, pr.full_name;
$$;

revoke execute on function public.get_my_class_teachers() from public, anon;
grant execute on function public.get_my_class_teachers() to authenticated;
