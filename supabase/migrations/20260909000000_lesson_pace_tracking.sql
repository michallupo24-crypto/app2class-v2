-- Coordinator-interface audit found the school has no way to compare "lessons
-- that should have happened by now" (from the timetable + calendar) against
-- "lessons that actually happened" (from the lessons table), per class per
-- subject - and RollCallPage.tsx, which is the one screen that actually
-- writes real lessons/attendance rows, has never recorded which real subject
-- or syllabus topic a lesson covered (it stuffs the free-text topic into
-- lessons.subject and leaves the dedicated topic column unused). This
-- migration adds the pieces needed to compute a real pace number and act on
-- it: weekly-hours resolution, a calendar-aware "expected lessons" count
-- (same logic as src/utils/pedagogicalPlanUtils.ts, moved server-side so
-- every role can call it under RLS), a request-tutoring table for homeroom
-- teachers, and an opportunistic (no pg_cron in this project) alert check for
-- coordinators.

-- 1. subject_coordinator could not set subject_requirements.weekly_hours (the
-- "weekly hours per subject" a principal enters) - only grade_coordinator/
-- management/system_admin could, per 20260816040000_timetable_builder.sql.
create policy "Subject coordinators can manage own-subject requirements" on public.subject_requirements
for all to authenticated
using (
  school_id = public.current_user_school_id()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = subject_requirements.subject
  )
)
with check (
  school_id = public.current_user_school_id()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = subject_requirements.subject
  )
);

-- 2. Homeroom "request tutoring" workflow. tutoring_sessions is top-down only
-- (coordinator/management create it directly, scoped by grade not class, no
-- request/approval concept) - this is the missing bottom-up half.
create table public.tutoring_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null,
  requested_by uuid not null references auth.users(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  linked_session_id uuid references public.tutoring_sessions(id),
  created_at timestamptz not null default now()
);
alter table public.tutoring_requests enable row level security;

create policy "Homeroom teacher can create own class tutoring request" on public.tutoring_requests
for insert to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'educator' and ur.homeroom_class_id = tutoring_requests.class_id
  )
);

create policy "Requester and coordinators can view tutoring requests" on public.tutoring_requests
for select to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'grade_coordinator'
      and ur.grade = (select c.grade from public.classes c where c.id = tutoring_requests.class_id)
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = tutoring_requests.subject
  )
  or has_role(auth.uid(), 'management') or has_role(auth.uid(), 'system_admin')
);

create policy "Coordinators can resolve tutoring requests" on public.tutoring_requests
for update to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'grade_coordinator'
      and ur.grade = (select c.grade from public.classes c where c.id = tutoring_requests.class_id)
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = tutoring_requests.subject
  )
  or has_role(auth.uid(), 'management') or has_role(auth.uid(), 'system_admin')
)
with check (true);

-- 3. Weekly-hours resolution: subject_requirements for this exact class, else
-- the grade-wide requirement row (class_id is null), else fall back to
-- however many weekly timetable slots this class actually has for the subject.
create or replace function public.get_subject_weekly_hours(p_class_id uuid, p_subject text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select sr.weekly_hours from public.subject_requirements sr
      where sr.class_id = p_class_id and sr.subject = p_subject limit 1),
    (select sr.weekly_hours from public.subject_requirements sr
      join public.classes c on c.id = p_class_id
      where sr.class_id is null and sr.school_id = c.school_id and sr.grade = c.grade and sr.subject = p_subject
      limit 1),
    (select count(*)::int from public.timetable_slots ts where ts.class_id = p_class_id and ts.subject = p_subject)
  );
$$;
revoke execute on function public.get_subject_weekly_hours(uuid, text) from public, anon;
grant execute on function public.get_subject_weekly_hours(uuid, text) to authenticated;

-- 4. Calendar-aware "lessons that should have happened" count - same logic as
-- calculateActualLessons() in src/utils/pedagogicalPlanUtils.ts (weekly
-- timetable slots minus days that overlap a school_events row), moved
-- server-side so it can run as one RPC across every class in a grade/subject
-- without per-role RLS on timetable_slots/school_events getting in the way.
create or replace function public.count_scheduled_lessons(p_class_id uuid, p_subject text, p_start date, p_end date)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_day date := p_start;
  v_dow int;
  v_slots_per_day int;
  v_school_id uuid;
begin
  if p_start > p_end then return 0; end if;
  select school_id into v_school_id from public.classes where id = p_class_id;

  while v_day <= p_end loop
    v_dow := extract(dow from v_day)::int;
    select count(*) into v_slots_per_day from public.timetable_slots ts
      where ts.class_id = p_class_id and ts.subject = p_subject and ts.day_of_week = v_dow;

    if v_slots_per_day > 0 and not exists (
      select 1 from public.school_events e
      where v_day between e.start_date and e.end_date
        and (e.school_id is null or e.school_id = v_school_id)
    ) then
      v_count := v_count + v_slots_per_day;
    end if;

    v_day := v_day + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.count_scheduled_lessons(uuid, text, date, date) from public, anon;
grant execute on function public.count_scheduled_lessons(uuid, text, date, date) to authenticated;

-- 5. Per-class pace: weekly hours, expected lessons since the school year
-- started (Sept 1), and lessons actually recorded via RollCallPage in that
-- span. Readable by the class's own teachers, its grade/subject coordinators,
-- and management.
create or replace function public.get_class_lesson_pace(p_class_id uuid, p_subject text)
returns table(weekly_hours int, expected_lessons int, actual_lessons int, deficit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_grade grade_level;
  v_year_start date;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select c.school_id, c.grade into v_school_id, v_grade from public.classes c where c.id = p_class_id;
  if v_school_id is null then raise exception 'Class not found'; end if;

  if not (
    exists (select 1 from public.teacher_classes tc where tc.user_id = auth.uid() and tc.class_id = p_class_id)
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'educator' and ur.homeroom_class_id = p_class_id)
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'grade_coordinator' and ur.grade = v_grade)
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = p_subject)
    or has_role(auth.uid(), 'management') or has_role(auth.uid(), 'system_admin')
  ) then
    raise exception 'Not authorized';
  end if;

  v_year_start := make_date((extract(year from now()) - case when extract(month from now()) < 8 then 1 else 0 end)::int, 9, 1);

  return query
  select
    public.get_subject_weekly_hours(p_class_id, p_subject),
    public.count_scheduled_lessons(p_class_id, p_subject, v_year_start, current_date),
    (select count(*)::int from public.lessons l where l.class_id = p_class_id and l.subject = p_subject and l.lesson_date between v_year_start and current_date),
    public.count_scheduled_lessons(p_class_id, p_subject, v_year_start, current_date)
      - (select count(*)::int from public.lessons l where l.class_id = p_class_id and l.subject = p_subject and l.lesson_date between v_year_start and current_date);
end;
$$;
revoke execute on function public.get_class_lesson_pace(uuid, text) from public, anon;
grant execute on function public.get_class_lesson_pace(uuid, text) to authenticated;

-- 6. Grade-wide pace, one row per class (+ subject, if the caller didn't pin
-- one) - the grade coordinator's per-class view, and the subject
-- coordinator's per-class view when they pass their own subject.
create or replace function public.get_grade_lesson_pace(p_grade grade_level, p_subject text default null)
returns table(class_id uuid, class_number int, subject text, weekly_hours int, expected_lessons int, actual_lessons int, deficit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_year_start date;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select school_id into v_school_id from public.profiles where id = auth.uid();

  if not (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'grade_coordinator' and ur.grade = p_grade)
    or (p_subject is not null and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = p_subject))
    or has_role(auth.uid(), 'management') or has_role(auth.uid(), 'system_admin')
  ) then
    raise exception 'Not authorized';
  end if;

  v_year_start := make_date((extract(year from now()) - case when extract(month from now()) < 8 then 1 else 0 end)::int, 9, 1);

  return query
  select
    c.id as class_id,
    c.class_number,
    subj.subject,
    public.get_subject_weekly_hours(c.id, subj.subject),
    public.count_scheduled_lessons(c.id, subj.subject, v_year_start, current_date),
    (select count(*)::int from public.lessons l where l.class_id = c.id and l.subject = subj.subject and l.lesson_date between v_year_start and current_date),
    public.count_scheduled_lessons(c.id, subj.subject, v_year_start, current_date)
      - (select count(*)::int from public.lessons l where l.class_id = c.id and l.subject = subj.subject and l.lesson_date between v_year_start and current_date)
  from public.classes c
  cross join lateral (
    select distinct ts.subject from public.timetable_slots ts
    where ts.class_id = c.id and (p_subject is null or ts.subject = p_subject)
  ) subj
  where c.grade = p_grade and c.school_id = v_school_id;
end;
$$;
revoke execute on function public.get_grade_lesson_pace(grade_level, text) from public, anon;
grant execute on function public.get_grade_lesson_pace(grade_level, text) to authenticated;

-- 7. Extreme-deficit alert, opportunistic like check_missing_exam_material()
-- (no pg_cron in this project) - called from the coordinator dashboards on
-- load, notifies the calling coordinator about their own classes/subject only,
-- de-duplicated by scanning their last 7 days of notifications for the same
-- class id embedded in the body.
create or replace function public.check_lesson_pace_alerts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_year_start date;
  v_threshold int := 4;
  v_count int := 0;
  v_row record;
  v_already_sent boolean;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select school_id into v_school_id from public.profiles where id = auth.uid();
  v_year_start := make_date((extract(year from now()) - case when extract(month from now()) < 8 then 1 else 0 end)::int, 9, 1);

  for v_row in
    select c.id as class_id, c.grade, c.class_number, subj.subject,
      public.count_scheduled_lessons(c.id, subj.subject, v_year_start, current_date) as expected,
      (select count(*)::int from public.lessons l where l.class_id = c.id and l.subject = subj.subject and l.lesson_date between v_year_start and current_date) as actual
    from public.classes c
    cross join lateral (select distinct ts.subject from public.timetable_slots ts where ts.class_id = c.id) subj
    where c.school_id = v_school_id
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'grade_coordinator' and ur.grade = c.grade)
        or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = subj.subject)
      )
  loop
    if (v_row.expected - v_row.actual) >= v_threshold then
      select exists(
        select 1 from public.notifications n
        where n.user_id = auth.uid() and n.type = 'lesson_pace_alert'
          and n.body like '%(class:' || v_row.class_id || ')%'
          and n.created_at > now() - interval '7 days'
      ) into v_already_sent;

      if not v_already_sent then
        perform public.create_notification(
          auth.uid(), 'lesson_pace_alert',
          'פער שיעורים חריג בכיתה ' || v_row.grade || '''' || v_row.class_number,
          'במקצוע ' || v_row.subject || ' נצבר פער של ' || (v_row.expected - v_row.actual) || ' שיעורים מהצפוי. (class:' || v_row.class_id || ')',
          '/dashboard/grade-progress'
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.check_lesson_pace_alerts() from public, anon;
grant execute on function public.check_lesson_pace_alerts() to authenticated;
