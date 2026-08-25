-- "Staff can approve users" (20260210234527) let management/educator/
-- grade_coordinator/system_admin update ANY column on ANY profile in ANY
-- school - flagged during the secretary-role work, fixing now on request.
-- system_admin stays unscoped (global reach is correct for that role,
-- matching the convention used everywhere else in this codebase); the
-- other three roles are scoped to their own school on both the row being
-- targeted (USING) and the row's resulting state (WITH CHECK, so a profile
-- can't be reassigned to a different school either).
drop policy if exists "Staff can approve users" on public.profiles;
create policy "Staff can approve users" on public.profiles
for update to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or (
    (has_role(auth.uid(), 'management') or has_role(auth.uid(), 'educator') or has_role(auth.uid(), 'grade_coordinator'))
    and school_id = public.current_user_school_id()
  )
)
with check (
  has_role(auth.uid(), 'system_admin')
  or (
    (has_role(auth.uid(), 'management') or has_role(auth.uid(), 'educator') or has_role(auth.uid(), 'grade_coordinator'))
    and school_id = public.current_user_school_id()
  )
);
