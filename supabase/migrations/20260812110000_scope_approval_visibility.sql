-- The approval-workflow RLS only ever checked "does the viewer have the
-- required_role", with zero scoping. Confirmed live: this lets any educator
-- in ANY school see and approve/reject any student's registration anywhere,
-- and any grade/subject coordinator approve staff registrations from other
-- schools. Spec explicitly requires student (and parent) approval requests
-- route to that specific class's homeroom teacher only (page 2: "role ==
-- student -> alert sent to the form_teacher of that class"), and implicitly
-- that approvers only ever act within their own school.
--
-- Fix: system_admin keeps full visibility (spec's "root" account, sees all
-- schools). Everyone else must additionally match the requester's school_id,
-- and when required_role = 'educator' must be the exact homeroom teacher of
-- the requesting student's class - either the student registering directly,
-- or a parent registering whose linked child (via parent_student) is in
-- that class.

drop policy if exists "Approvers can view pending" on public.approvals;
drop policy if exists "Approvers can view pending approvals" on public.approvals;
drop policy if exists "Approvers can update approvals" on public.approvals;

create policy "Approvers can view pending" on public.approvals for select using (
  has_role(auth.uid(), 'system_admin'::app_role)
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

create policy "Approvers can update approvals" on public.approvals for update using (
  has_role(auth.uid(), 'system_admin'::app_role)
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
