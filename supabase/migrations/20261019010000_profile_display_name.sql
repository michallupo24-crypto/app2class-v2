-- Display name (שם תצוגה): a name shown everywhere instead of the legal name
-- in full_name - e.g. the surname of the parent a student is in contact with,
-- or a nickname instead of an uncommon first name. full_name stays the legal
-- name (registration, ID matching, official reports).
--
-- Only system_admin, the school's management, and the grade coordinator of
-- the student's grade may set or clear it, and never for themselves. Every
-- other write path is closed: the "Staff can approve users" UPDATE policy
-- lets educators update profiles and the own-row policy lets users update
-- themselves, so a trigger rejects any direct change to the column from an
-- API role. The only way in is set_display_name() below.

alter table public.profiles add column if not exists display_name text;

-- A real-looking name, not a username: Hebrew/English letters separated by
-- single spaces, hyphens (- or maqaf ־) or apostrophes (' ’ ׳), 2-40 chars.
alter table public.profiles drop constraint if exists profiles_display_name_format;
alter table public.profiles add constraint profiles_display_name_format check (
  display_name is null or (
    char_length(display_name) between 2 and 40
    and display_name ~ '^[A-Za-zא-ת]+([ ''’׳־-][A-Za-zא-ת]+)*[''’׳]?$'
  )
);

create or replace function public.guard_profile_display_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Not security definer on purpose: current_user is the API role for
  -- direct client writes, and the function owner inside set_display_name().
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.display_name := null;
    elsif new.display_name is distinct from old.display_name then
      raise exception 'display_name can only be changed through set_display_name()'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_display_name on public.profiles;
create trigger trg_guard_profile_display_name
  before insert or update on public.profiles
  for each row execute function public.guard_profile_display_name();

-- Whether the caller may set/clear the display name of p_user_id.
create or replace function public.can_set_display_name(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and p_user_id <> auth.uid()
    and (
      has_role(auth.uid(), 'system_admin')
      or exists (
        select 1 from public.profiles t
        where t.id = p_user_id
          and t.school_id is not null
          and t.school_id = public.current_user_school_id()
          and (
            has_role(auth.uid(), 'management')
            or exists (
              select 1
              from public.classes c
              join public.user_roles r
                on r.user_id = auth.uid() and r.role = 'grade_coordinator' and r.grade = c.grade
              where c.id = t.class_id
            )
          )
      )
    )
$$;

create or replace function public.set_display_name(p_user_id uuid, p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), '');
begin
  if not public.can_set_display_name(p_user_id) then
    raise exception 'not allowed to set the display name of this user' using errcode = '42501';
  end if;
  update public.profiles set display_name = v_name where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;
  return v_name;
end;
$$;

revoke execute on function public.can_set_display_name(uuid) from public, anon;
grant execute on function public.can_set_display_name(uuid) to authenticated;
revoke execute on function public.set_display_name(uuid, text) from public, anon;
grant execute on function public.set_display_name(uuid, text) to authenticated;

-- The chat's "my teachers" list shows the display name too (same body as in
-- 20261018040000_auto_chat_groups, only the name column changed).
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
         coalesce(pr.display_name, pr.full_name),
         array_remove(array_agg(distinct t.subject), null),
         bool_or(t.is_homeroom),
         min(c.grade::text || '-' || c.class_number)
  from t
  join public.profiles pr on pr.id = t.user_id
  join public.classes c on c.id = t.class_id
  group by t.user_id, pr.display_name, pr.full_name
  order by bool_or(t.is_homeroom) desc, coalesce(pr.display_name, pr.full_name);
$$;

revoke execute on function public.get_my_class_teachers() from public, anon;
grant execute on function public.get_my_class_teachers() to authenticated;
