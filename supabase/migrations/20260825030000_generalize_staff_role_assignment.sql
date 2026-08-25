-- Phase 1's user_roles grant/revoke policies only ever covered council_advisor.
-- Generalize to the full set of staff roles management should be able to
-- assign post-hoc from the team-roles admin page: subject_coordinator,
-- grade_coordinator, counselor, professional_teacher, and management itself.
-- system_admin/super_admin stay bootstrap-only, deliberately excluded.
drop policy if exists "Management can grant council_advisor" on public.user_roles;
create policy "Management can grant staff roles" on public.user_roles
for insert to authenticated
with check (
  role in ('council_advisor', 'subject_coordinator', 'grade_coordinator', 'counselor', 'professional_teacher', 'management')
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);

drop policy if exists "Management can revoke council_advisor" on public.user_roles;
create policy "Management can revoke staff roles" on public.user_roles
for delete to authenticated
using (
  role in ('council_advisor', 'subject_coordinator', 'grade_coordinator', 'counselor', 'professional_teacher', 'management')
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);
