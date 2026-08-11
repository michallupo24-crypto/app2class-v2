-- StudentGradesPage calls public.get_assignment_averages(p_assignment_ids uuid[]) to show
-- the class average next to each of the student's own grades, but the RPC never existed —
-- this mirrors get_class_average's SECURITY DEFINER pattern (20260810080000) so it can
-- aggregate across the whole class without exposing individual students' grades.

create or replace function public.get_assignment_averages(p_assignment_ids uuid[])
returns table(assignment_id uuid, avg_grade numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  return query
  select a.id, round(avg(s.grade::numeric), 1)
  from public.assignments a
  join public.submissions s on s.assignment_id = a.id and s.grade is not null
  where a.id = any(p_assignment_ids)
    and (
      has_role(auth.uid(), 'educator'::app_role) or
      has_role(auth.uid(), 'management'::app_role) or
      has_role(auth.uid(), 'system_admin'::app_role) or
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.class_id = a.class_id) or
      exists (
        select 1 from public.parent_student ps
        join public.profiles p on p.id = ps.student_id
        where ps.parent_id = auth.uid() and p.class_id = a.class_id
      )
    )
  group by a.id;
end;
$$;

revoke execute on function public.get_assignment_averages(uuid[]) from public, anon;
grant execute on function public.get_assignment_averages(uuid[]) to authenticated;
