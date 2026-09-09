-- get_school_grade_averages and get_grade_coordinator_class_stats were moved
-- to a weight_percent-weighted average in 20260826040000_weighted_grade_rpcs.sql
-- to match src/lib/gradeMath.ts, but get_subject_coordinator_grade_stats was
-- never included in that fix - the coordinator-interface audit caught it
-- still using a plain unweighted average, so it disagrees with every other
-- grade view in the app for the exact same underlying data.

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
    round(
      sum((s.grade::numeric / coalesce(a.max_grade, 100)) * 100 * coalesce(nullif(a.weight_percent, 0), 10))
      / sum(coalesce(nullif(a.weight_percent, 0), 10))
    )::int as avg_grade,
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
