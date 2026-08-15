-- Fixes get_school_grade_averages (20260815000000): c.grade is the
-- grade_level enum, not text, and RETURN QUERY requires an exact type match
-- against the declared RETURNS TABLE column - the first version failed at
-- call time with "structure of query does not match function result type".

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
