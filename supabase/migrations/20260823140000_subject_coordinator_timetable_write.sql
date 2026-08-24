-- Subject coordinators use the "השלמות ותיקונים" tab (CoordinatorTeacherHours.tsx)
-- to fill real teachers into placeholder slots the auto-generator created. But
-- the only write policy on timetable_slots (from 20260816040000_timetable_builder.sql)
-- grants INSERT/UPDATE/DELETE to system_admin/management/grade_coordinator only -
-- subject_coordinator was never included. Postgrest silently returns 200 with
-- an empty body when RLS filters out every row a write targets (not an error),
-- so every placement attempt from that screen looked like a no-op click rather
-- than a permissions failure. Scope the coordinator's write access to rows in
-- their own subject only, not the whole school's timetable.

create policy "Subject coordinators can update own-subject timetable slots" on public.timetable_slots
for update to authenticated
using (
  school_id = public.current_user_school_id()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = timetable_slots.subject
  )
)
with check (
  school_id = public.current_user_school_id()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = timetable_slots.subject
  )
);

create policy "Subject coordinators can insert own-subject timetable slots" on public.timetable_slots
for insert to authenticated
with check (
  school_id = public.current_user_school_id()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'subject_coordinator' and ur.subject = timetable_slots.subject
  )
);
