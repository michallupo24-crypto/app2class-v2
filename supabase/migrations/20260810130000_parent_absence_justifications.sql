-- Bug fix: StudentAttendancePage's parent view (isParentView, /dashboard/attendance/:studentId)
-- let a parent submit an absence justification for their child, but even after fixing the
-- frontend to send the child's real student_id, RLS on absence_justifications only allowed
-- a row's own student to select/insert it (student_id = auth.uid()) — a parent submitting on
-- behalf of a linked child would still be rejected. This adds the matching parent-scoped
-- policies, mirroring the parent_student-based policies already used for attendance/submissions
-- (20260326000001_stage10_parent.sql) and grade_announcements notifications.

create policy "Parents can view children's justification requests" on public.absence_justifications
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_student ps
      where ps.parent_id = auth.uid() and ps.student_id = absence_justifications.student_id
    )
  );

create policy "Parents can submit justification requests for children" on public.absence_justifications
  for insert to authenticated
  with check (
    exists (
      select 1 from public.parent_student ps
      where ps.parent_id = auth.uid() and ps.student_id = absence_justifications.student_id
    )
  );

-- StudentAttendancePage's "commendations" section reads lesson_notes for the viewed
-- student; lesson_notes only had teacher/educator/management/counselor SELECT policies,
-- so a parent viewing their child's page silently got an empty list. Same parent_student scoping.
create policy "Parents can view children's lesson notes" on public.lesson_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_student ps
      where ps.parent_id = auth.uid() and ps.student_id = lesson_notes.student_id
    )
  );
