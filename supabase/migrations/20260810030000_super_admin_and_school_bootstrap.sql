-- 0.6 (2/2): super_admin inherits everything system_admin can already do
-- (rather than rewriting every existing system_admin RLS policy across the
-- schema), and gets exclusive rights to platform-root actions: creating new
-- schools with their org structure pre-built, and (enforced in the
-- admin-manage-user edge function) the kill-switch.

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and (role = _role or (role = 'super_admin'::app_role and _role = 'system_admin'::app_role))
  )
$$;

-- Grant super_admin to the existing seed system_admin account so there is a
-- working root account immediately after this migration.
insert into public.user_roles (user_id, role)
select ur.user_id, 'super_admin'::app_role
from public.user_roles ur
where ur.role = 'system_admin'::app_role
on conflict do nothing;

create or replace function public.bootstrap_school(p_school_name text, p_classes_per_grade int default 1)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_grade grade_level;
  v_n int;
begin
  if not has_role(auth.uid(), 'super_admin'::app_role) then
    raise exception 'Only a super admin can bootstrap a new school';
  end if;

  insert into public.schools (name) values (p_school_name) returning id into v_school_id;

  foreach v_grade in array enum_range(null::grade_level) loop
    for v_n in 1..greatest(1, p_classes_per_grade) loop
      insert into public.classes (school_id, grade, class_number) values (v_school_id, v_grade, v_n);
    end loop;
  end loop;

  return v_school_id;
end;
$$;

revoke execute on function public.bootstrap_school(text, int) from public, anon;
grant execute on function public.bootstrap_school(text, int) to authenticated;
