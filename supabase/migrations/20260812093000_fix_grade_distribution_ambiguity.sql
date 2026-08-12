-- get_grade_distribution's OUT parameters (bucket_label, bucket_min) collide with
-- the CTE's column aliases of the same name, causing "column reference is
-- ambiguous" at call time (caught via live testing). Qualify with the CTE alias.

create or replace function public.get_grade_distribution(p_class_id uuid, p_subject text)
returns table(bucket_label text, bucket_min int, student_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not (
    has_role(auth.uid(), 'educator'::app_role) or
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'system_admin'::app_role) or
    has_role(auth.uid(), 'grade_coordinator'::app_role) or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.class_id = p_class_id) or
    exists (
      select 1 from public.parent_student ps
      join public.profiles p on p.id = ps.student_id
      where ps.parent_id = auth.uid() and p.class_id = p_class_id
    )
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  with per_student as (
    select s.student_id, avg(s.grade::numeric) as avg_grade
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.class_id = p_class_id
      and a.subject = p_subject
      and s.grade is not null
    group by s.student_id
  ),
  bucketed as (
    select
      case
        when avg_grade >= 90 then '90-100'
        when avg_grade >= 80 then '80-89'
        when avg_grade >= 70 then '70-79'
        when avg_grade >= 60 then '60-69'
        else 'מתחת ל-60'
      end as label,
      case
        when avg_grade >= 90 then 90
        when avg_grade >= 80 then 80
        when avg_grade >= 70 then 70
        when avg_grade >= 60 then 60
        else 0
      end as min_val
    from per_student
  )
  select bucketed.label, bucketed.min_val, count(*)::int as student_count
  from bucketed
  group by bucketed.label, bucketed.min_val
  order by bucketed.min_val;
end;
$$;
