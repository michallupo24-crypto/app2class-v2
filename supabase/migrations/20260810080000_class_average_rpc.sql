-- 2.P2: ParentDashboardPage hardcoded classAvg: null — there was no way to
-- compute it client-side since submissions RLS correctly restricts parents
-- to their own child's rows only (verified: no policy lets a parent read
-- another student's submissions). A real class average requires aggregating
-- across the whole class, so this is a SECURITY DEFINER RPC that returns
-- only the aggregate number — never individual students' grades.

create or replace function public.get_class_average(p_class_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not (
    has_role(auth.uid(), 'educator'::app_role) or
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'system_admin'::app_role) or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.class_id = p_class_id) or
    exists (
      select 1 from public.parent_student ps
      join public.profiles p on p.id = ps.student_id
      where ps.parent_id = auth.uid() and p.class_id = p_class_id
    )
  ) then
    raise exception 'Not authorized';
  end if;

  select round(
    sum((s.grade::numeric / coalesce(a.max_grade, 100)) * 100 * coalesce(a.weight_percent, 10))
    / nullif(sum(coalesce(a.weight_percent, 10)), 0)
  )
  into v_result
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where a.class_id = p_class_id and s.grade is not null;

  return v_result;
end;
$$;

revoke execute on function public.get_class_average(uuid) from public, anon;
grant execute on function public.get_class_average(uuid) to authenticated;
