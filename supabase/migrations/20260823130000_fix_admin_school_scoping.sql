-- admin@il (the system_admin bootstrap account, see 20260810030000) was
-- reported showing school-scoped data and a "management of תיכון חדש"
-- status instead of true global access. A real system_admin must have
-- school_id = null (current_user_school_id() and every school-scoped RLS
-- policy treat a non-null school_id as "this user belongs to exactly that
-- school") and should not also hold a school-bound role like management -
-- likely picked up from testing the school-bootstrap flow with this same
-- email. Targeted at this one known account only, same pattern as the QA
-- cleanup in 20260823070000.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.profiles where email = 'admin@il';

  if v_user_id is not null then
    -- Clear the stray school association so system_admin reads as truly global.
    update public.profiles set school_id = null where id = v_user_id;

    -- Keep system_admin; drop any school-bound role that got attached to
    -- the same account (management/educator/etc. - anything that isn't
    -- the global system_admin role itself).
    delete from public.user_roles
    where user_id = v_user_id and role <> 'system_admin'::app_role;

    -- Make sure system_admin is actually present (bootstrap creates it,
    -- but don't leave the account role-less if it was somehow missing).
    insert into public.user_roles (user_id, role)
    values (v_user_id, 'system_admin'::app_role)
    on conflict do nothing;
  end if;
end $$;
