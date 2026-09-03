-- Auditing the parent/student/report-card/coordinator grade views found four
-- independent client-side reimplementations of "subject average" - only the
-- parent dashboard actually applied assignments.weight_percent (the other
-- three, plus these two RPCs, used a plain unweighted average). A student
-- could see a different overall grade on their own page than their parent
-- sees for the exact same data. The frontend pages now all share one weighted
-- formula (src/lib/gradeMath.ts); these two RPCs get the same weighting so
-- the coordinator/principal aggregate views agree with it too.
--
-- Weight fallback matches the client-side one exactly: an assignment with no
-- (or zero) weight_percent counts as weight 10, so it isn't silently dropped
-- from the average instead of just counting less.

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
      (s.grade::numeric / coalesce(a.max_grade, 100)) * 100 as normalized_grade,
      coalesce(nullif(a.weight_percent, 0), 10)::numeric as weight
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classes c on c.id = a.class_id
    where c.school_id = p_school_id
      and s.status = 'graded'
      and s.grade is not null
  )
  select
    per_submission.class_grade,
    round(sum(per_submission.normalized_grade * per_submission.weight) / sum(per_submission.weight))::int as avg_grade,
    count(distinct per_submission.class_id)::int as class_count
  from per_submission
  group by per_submission.class_grade;
end;
$$;

revoke execute on function public.get_school_grade_averages(uuid) from public, anon;
grant execute on function public.get_school_grade_averages(uuid) to authenticated;

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
    round(
      sum((s.grade::numeric / coalesce(a.max_grade, 100)) * 100 * coalesce(nullif(a.weight_percent, 0), 10))
      / sum(coalesce(nullif(a.weight_percent, 0), 10))
    )::int as avg_grade,
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
