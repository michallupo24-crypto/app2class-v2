-- New staff roles, part 4/4: permissions for exam_coordinator, secretary,
-- and parent_committee_rep, plus wiring all three into the existing
-- generalized role-assignment policy from 20260825030000.

-- 0. Let management grant/revoke all three new roles too, same as the six
--    roles already generalized.
drop policy if exists "Management can grant staff roles" on public.user_roles;
create policy "Management can grant staff roles" on public.user_roles
for insert to authenticated
with check (
  role in ('council_advisor', 'subject_coordinator', 'grade_coordinator', 'counselor', 'professional_teacher', 'management', 'exam_coordinator', 'secretary', 'parent_committee_rep')
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);

drop policy if exists "Management can revoke staff roles" on public.user_roles;
create policy "Management can revoke staff roles" on public.user_roles
for delete to authenticated
using (
  role in ('council_advisor', 'subject_coordinator', 'grade_coordinator', 'counselor', 'professional_teacher', 'management', 'exam_coordinator', 'secretary', 'parent_committee_rep')
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);

-- 1. Exam coordinator: full (own-school) control of the exam calendar,
--    matching grade_coordinator's reach but school-scoped (their sibling
--    policy isn't - not replicating that gap into the new one).
create policy "Exam coordinators can manage own-school grade events" on public.grade_events
for all to authenticated
using (has_role(auth.uid(), 'exam_coordinator') and school_id = public.current_user_school_id())
with check (has_role(auth.uid(), 'exam_coordinator') and school_id = public.current_user_school_id());

drop policy if exists "Teaching staff can upload to exam archive" on public.exam_archive;
create policy "Teaching staff can upload to exam archive" on public.exam_archive
for insert to authenticated
with check (
  uploaded_by = auth.uid() and (
    has_role(auth.uid(), 'professional_teacher') or
    has_role(auth.uid(), 'subject_coordinator') or
    has_role(auth.uid(), 'grade_coordinator') or
    has_role(auth.uid(), 'exam_coordinator') or
    has_role(auth.uid(), 'management') or
    has_role(auth.uid(), 'system_admin')
  )
);

drop policy if exists "Uploaders and admin can delete archive entries" on public.exam_archive;
create policy "Uploaders and admin can delete archive entries" on public.exam_archive
for delete to authenticated
using (
  uploaded_by = auth.uid()
  or has_role(auth.uid(), 'exam_coordinator')
  or has_role(auth.uid(), 'management')
  or has_role(auth.uid(), 'system_admin')
);

-- No UPDATE policy existed at all on exam_archive before this.
create policy "Uploaders and exam coordinators can edit archive entries" on public.exam_archive
for update to authenticated
using (uploaded_by = auth.uid() or has_role(auth.uid(), 'exam_coordinator'))
with check (uploaded_by = auth.uid() or has_role(auth.uid(), 'exam_coordinator'));

-- 2. Secretary: approvals queue (school-wide, not homeroom-restricted like
--    the educator branch), contact-info updates (own new scoped policy -
--    NOT extending the existing unscoped "Staff can approve users" policy),
--    and non-emergency school-wide announcements.
drop policy if exists "Approvers can view pending" on public.approvals;
create policy "Approvers can view pending" on public.approvals for select using (
  has_role(auth.uid(), 'system_admin'::app_role)
  or (
    has_role(auth.uid(), 'secretary'::app_role)
    and approvals.required_role = 'educator'::app_role
    and exists (
      select 1 from public.profiles req_p
      join public.profiles appr_p on appr_p.id = auth.uid()
      where req_p.id = approvals.user_id and req_p.school_id = appr_p.school_id
    )
  )
  or (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = approvals.required_role
    )
    and exists (
      select 1 from public.profiles req_p
      join public.profiles appr_p on appr_p.id = auth.uid()
      where req_p.id = approvals.user_id
        and req_p.school_id = appr_p.school_id
    )
    and (
      approvals.required_role <> 'educator'::app_role
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role = 'educator'::app_role
          and ur.homeroom_class_id in (
            select class_id from public.profiles where id = approvals.user_id and class_id is not null
            union
            select p.class_id from public.parent_student ps
            join public.profiles p on p.id = ps.student_id
            where ps.parent_id = approvals.user_id and p.class_id is not null
          )
      )
    )
  )
);

drop policy if exists "Approvers can update approvals" on public.approvals;
create policy "Approvers can update approvals" on public.approvals for update using (
  has_role(auth.uid(), 'system_admin'::app_role)
  or (
    has_role(auth.uid(), 'secretary'::app_role)
    and approvals.required_role = 'educator'::app_role
    and exists (
      select 1 from public.profiles req_p
      join public.profiles appr_p on appr_p.id = auth.uid()
      where req_p.id = approvals.user_id and req_p.school_id = appr_p.school_id
    )
  )
  or (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = approvals.required_role
    )
    and exists (
      select 1 from public.profiles req_p
      join public.profiles appr_p on appr_p.id = auth.uid()
      where req_p.id = approvals.user_id
        and req_p.school_id = appr_p.school_id
    )
    and (
      approvals.required_role <> 'educator'::app_role
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role = 'educator'::app_role
          and ur.homeroom_class_id in (
            select class_id from public.profiles where id = approvals.user_id and class_id is not null
            union
            select p.class_id from public.parent_student ps
            join public.profiles p on p.id = ps.student_id
            where ps.parent_id = approvals.user_id and p.class_id is not null
          )
      )
    )
  )
);

create policy "Secretary can update own-school profile contact info" on public.profiles
for update to authenticated
using (has_role(auth.uid(), 'secretary') and school_id = public.current_user_school_id())
with check (has_role(auth.uid(), 'secretary') and school_id = public.current_user_school_id());

drop policy if exists "Management can create school announcements" on public.system_announcements;
create policy "Management can create school announcements" on public.system_announcements
for insert to authenticated
with check (
  (has_role(auth.uid(), 'management') and school_id = (select school_id from public.profiles where id = auth.uid()))
  or has_role(auth.uid(), 'system_admin')
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
  or (has_role(auth.uid(), 'secretary') and school_id = public.current_user_school_id() and severity = 'info')
);

-- 3. Parent-committee rep: no RLS changes needed for parent_student or
--    system_announcements SELECT (already fine for any parent/any school
--    member respectively) - the one real gap is that 'info'-severity
--    announcements never generate a notification for anyone (only
--    'emergency' ones do). Extend the existing trigger to also notify
--    active committee reps on regular announcements, so they get a real
--    "sees it first" signal via the bell instead of just the passive banner.
create or replace function public.notify_emergency_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity = 'emergency' then
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, new.school_id, 'emergency_announcement', new.title, new.content, '/dashboard'
    from public.profiles p
    where new.school_id is null or p.school_id = new.school_id;
  elsif new.severity = 'info' then
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, new.school_id, 'school_announcement', new.title, new.content, '/dashboard'
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'parent_committee_rep'
    where new.school_id is null or p.school_id = new.school_id;
  end if;
  return new;
end;
$$;
