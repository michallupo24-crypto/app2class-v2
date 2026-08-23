-- Parent dashboard already compares grades to the class average
-- (get_class_average, 20260810080000) but nothing else - attendance,
-- in-lesson focus, and homework submission rate were each shown only as
-- the child's own raw number, with no class-average context to tell a
-- parent whether that number is normal or a real outlier. Same
-- SECURITY DEFINER / aggregate-only / no-row-leakage pattern as
-- get_class_average, just per-student instead of per-class and covering
-- three metrics instead of one round-trip each.

create or replace function public.get_child_class_comparison(p_student_id uuid)
returns table (
  child_absence_rate numeric,
  class_absence_rate numeric,
  child_focus_avg numeric,
  class_focus_avg numeric,
  child_submission_rate numeric,
  class_submission_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.parent_student
    where parent_id = auth.uid() and student_id = p_student_id
  ) then
    raise exception 'Not authorized: not your child';
  end if;

  select class_id into v_class_id from public.profiles where id = p_student_id;
  if v_class_id is null then
    return;
  end if;

  return query
  with att as (
    select a.student_id,
      count(*) filter (where a.status = 'absent')::numeric / nullif(count(*), 0) as absence_rate
    from public.attendance a
    join public.lessons l on l.id = a.lesson_id
    where l.class_id = v_class_id
    group by a.student_id
  ),
  foc as (
    select f.student_id, avg(f.level) as focus_avg
    from public.focus_reports f
    join public.lessons l on l.id = f.lesson_id
    where l.class_id = v_class_id
    group by f.student_id
  ),
  subs as (
    select p.id as student_id,
      count(a.id) as assigned_ct,
      count(s.id) as submitted_ct
    from public.profiles p
    cross join public.assignments a
    left join public.submissions s
      on s.assignment_id = a.id and s.student_id = p.id and s.status <> 'draft'
    where p.class_id = v_class_id
      and a.class_id = v_class_id
      and a.published = true
      and a.due_date is not null and a.due_date < now()
    group by p.id
  )
  select
    coalesce((select absence_rate from att where student_id = p_student_id), 0),
    coalesce((select avg(absence_rate) from att), 0),
    coalesce((select focus_avg from foc where student_id = p_student_id), 0),
    coalesce((select avg(focus_avg) from foc), 0),
    coalesce((select submitted_ct::numeric / nullif(assigned_ct, 0) from subs where student_id = p_student_id), 0),
    coalesce((select avg(submitted_ct::numeric / nullif(assigned_ct, 0)) from subs), 0);
end;
$$;

revoke execute on function public.get_child_class_comparison(uuid) from public, anon;
grant execute on function public.get_child_class_comparison(uuid) to authenticated;
