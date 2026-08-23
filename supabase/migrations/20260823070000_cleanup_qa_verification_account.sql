-- Cleanup: removes the disposable QA account (qa-verify-principal-20260823@demo.il)
-- created during manual verification of the new PrincipalDashboardPage features
-- (supervisor inbox / yearly trend / bottleneck detection / PDF export), plus the
-- one supervisor_inquiries row it created. Test data only, no real school/student
-- data touched.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.profiles where email = 'qa-verify-principal-20260823@demo.il';

  if v_user_id is not null then
    delete from public.supervisor_inquiries where created_by = v_user_id or responded_by = v_user_id;
    delete from public.approvals where user_id = v_user_id;
    delete from public.avatars where user_id = v_user_id;
    delete from public.user_roles where user_id = v_user_id;
    delete from public.profiles where id = v_user_id;
    delete from auth.users where id = v_user_id;
  end if;
end $$;
