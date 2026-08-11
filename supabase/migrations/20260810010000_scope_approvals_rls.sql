-- 0.3: "Approvers can view/update pending approvals" only checked that the
-- approver holds the required role anywhere, with no school/class scoping.
-- Any educator in any school could see and approve students/parents that
-- belong to a completely different school. This scopes approvals to the
-- approver's own school, and further to their own homeroom class when the
-- required role is 'educator' (only the relevant homeroom teacher, per spec).

create or replace function public.can_approve(p_approver_id uuid, p_required_role app_role, p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    has_role(p_approver_id, 'system_admin'::app_role)
    or exists (
      select 1
      from public.profiles approver
      join public.profiles target on target.id = p_target_user_id
      where approver.id = p_approver_id
        and approver.school_id is not null
        and approver.school_id = target.school_id
        and (
          p_required_role <> 'educator'::app_role
          or exists (
            select 1 from public.user_roles ur
            where ur.user_id = p_approver_id
              and ur.role = 'educator'::app_role
              and ur.homeroom_class_id = target.class_id
          )
        )
    );
$$;

revoke execute on function public.can_approve(uuid, app_role, uuid) from public, anon;
grant execute on function public.can_approve(uuid, app_role, uuid) to authenticated;

drop policy if exists "Approvers can view pending approvals" on public.approvals;
create policy "Approvers can view pending approvals" on public.approvals
for select
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = approvals.required_role
  )
  and public.can_approve(auth.uid(), approvals.required_role, approvals.user_id)
);

drop policy if exists "Approvers can update approvals" on public.approvals;
create policy "Approvers can update approvals" on public.approvals
for update
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = approvals.required_role
  )
  and public.can_approve(auth.uid(), approvals.required_role, approvals.user_id)
);
