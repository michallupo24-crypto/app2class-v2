-- SubjectCoordinatorDashboard queried public.lessons and public.submissions
-- directly client-side. Neither "Staff can view lessons" nor "Staff can view
-- own-school submissions" grants subject_coordinator SELECT access (verified
-- against every RLS policy on both tables) - both queries silently return
-- empty arrays under RLS, so "כיתות מלמדות" always showed 0 and "ממוצע כללי
-- במקצוע" always showed "-" even when real data exists. Same fix pattern as
-- get_grade_coordinator_class_stats: SECURITY DEFINER RPCs that return only
-- what this dashboard actually needs, never raw per-student rows.

create or replace function public.get_subject_coordinator_class_count(p_subject text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_result int;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select p.school_id into v_school_id from public.profiles p where p.id = auth.uid();

  if not (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = p_subject
    )
    or has_role(auth.uid(), 'management'::app_role)
    or has_role(auth.uid(), 'system_admin'::app_role)
  ) then
    raise exception 'Not authorized';
  end if;

  select count(distinct l.class_id) into v_result
  from public.lessons l
  where l.school_id = v_school_id and l.subject = p_subject;

  return coalesce(v_result, 0);
end;
$$;

revoke execute on function public.get_subject_coordinator_class_count(text) from public, anon;
grant execute on function public.get_subject_coordinator_class_count(text) to authenticated;

create or replace function public.get_subject_coordinator_grade_stats(p_subject text)
returns table(grade grade_level, avg_grade int, grade_count int)
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
      where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = p_subject
    )
    or has_role(auth.uid(), 'management'::app_role)
    or has_role(auth.uid(), 'system_admin'::app_role)
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    c.grade,
    round(avg((s.grade::numeric / coalesce(a.max_grade, 100)) * 100))::int as avg_grade,
    count(*)::int as grade_count
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.classes c on c.id = a.class_id
  where c.school_id = v_school_id
    and a.subject = p_subject
    and s.grade is not null
  group by c.grade;
end;
$$;

revoke execute on function public.get_subject_coordinator_grade_stats(text) from public, anon;
grant execute on function public.get_subject_coordinator_grade_stats(text) to authenticated;
