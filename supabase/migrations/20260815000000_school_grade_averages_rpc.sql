-- PrincipalDashboardPage computed the school-wide grade averages by pulling
-- graded submissions client-side with `.limit(500)` and no `.order()` - for
-- any school with more than 500 graded submissions (trivial across a full
-- year, multiple classes and subjects), the "school average" KPI and the
-- per-grade bar chart were silently computed from an arbitrary 500-row slice
-- instead of the true average, with no indication of truncation. Doing the
-- aggregation in SQL removes the row-limit problem entirely (Postgres
-- aggregates server-side, never transfers per-submission rows to the client)
-- and matches the existing get_class_average/get_grade_distribution
-- SECURITY DEFINER pattern.

create or replace function public.get_school_grade_averages(p_school_id uuid)
returns table(grade text, avg_grade int, class_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not (
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'system_admin'::app_role)
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = p_school_id)
     and not has_role(auth.uid(), 'system_admin'::app_role) then
    raise exception 'Not authorized';
  end if;

  return query
  with per_submission as (
    select
      c.grade::text as class_grade,
      c.id as class_id,
      round((s.grade::numeric / coalesce(a.max_grade, 100)) * 100) as normalized_grade
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classes c on c.id = a.class_id
    where c.school_id = p_school_id
      and s.status = 'graded'
      and s.grade is not null
  )
  select
    per_submission.class_grade,
    round(avg(per_submission.normalized_grade))::int as avg_grade,
    count(distinct per_submission.class_id)::int as class_count
  from per_submission
  group by per_submission.class_grade;
end;
$$;

revoke execute on function public.get_school_grade_averages(uuid) from public, anon;
grant execute on function public.get_school_grade_averages(uuid) to authenticated;
