-- GradeProgressPage (רכז שכבה "דופק שכבתי") queried public.submissions
-- directly client-side. The "Staff can view own-school submissions" RLS
-- policy only grants SELECT to educator/management/system_admin/counselor -
-- grade_coordinator was never granted access. That query silently returns
-- an empty array under RLS (no error thrown), so the page renders its
-- legitimate-looking "אין נתוני שכבה זמינים" empty state even when real
-- grade data exists - a coordinator can never actually see it.
--
-- Rather than granting grade_coordinator broad raw SELECT on submissions
-- (which would also expose every other teacher's individual student grades,
-- feedback, etc. across the whole grade), this is a SECURITY DEFINER RPC
-- that returns only per-class-per-subject aggregates - mirrors the
-- get_grade_distribution / get_class_average pattern already used for the
-- parent-facing bell curve.

create or replace function public.get_grade_coordinator_class_stats(p_grade grade_level)
returns table(class_id uuid, subject text, avg_grade int, grade_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select p.school_id into v_school_id from public.profiles p where p.id = auth.uid();

  if not (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'grade_coordinator' and ur.grade = p_grade
    )
    or has_role(auth.uid(), 'management'::app_role)
    or has_role(auth.uid(), 'system_admin'::app_role)
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    c.id as class_id,
    a.subject,
    round(avg((s.grade::numeric / coalesce(a.max_grade, 100)) * 100))::int as avg_grade,
    count(*)::int as grade_count
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.classes c on c.id = a.class_id
  where c.grade = p_grade
    and c.school_id = v_school_id
    and s.status = 'graded'
    and s.grade is not null
  group by c.id, a.subject;
end;
$$;

revoke execute on function public.get_grade_coordinator_class_stats(grade_level) from public, anon;
grant execute on function public.get_grade_coordinator_class_stats(grade_level) to authenticated;
