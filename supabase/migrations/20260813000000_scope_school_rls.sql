-- Cross-school data leak fix: found via a full RLS audit (2026-08-13). Dozens of
-- policies granted access based on ROLE ONLY (has_role(...)) with no check that the
-- viewer and the row's owner belong to the same school - so e.g. any 'management'
-- or 'educator' at School A could read School B's grades, attendance, behavioral
-- notes, counselor case status, payment records, and more, straight through the
-- Supabase client API (bypassing the app's UI entirely).
--
-- public.profiles itself had already been through two rounds of this: scoping it
-- by school via a raw self-referential subquery caused Postgres recursion errors
-- (42P17), so both attempts (20260809140000, 20260809150000) gave up and fell back
-- to USING (true) - open to any authenticated user. The correct fix (noted but not
-- implemented in 20260809150000's own comment) is a SECURITY DEFINER helper, which
-- bypasses RLS for its internal read and therefore can't recurse. That helper is
-- added here first, then reused to properly scope every other vulnerable table.
--
-- Intentionally NOT covered here (lower-sensitivity, same bug class, left for a
-- follow-up pass): bell_schedule, timetable_slots, factions, faction_members,
-- flower_votes, syllabi, class_syllabus_progress, school_events, council_votes,
-- newspaper_articles, live_sessions, live_question_votes, chat_settings.

-- 0. Helper: caller's own school_id, via SECURITY DEFINER so reading it from
--    inside a policy on public.profiles itself doesn't re-trigger that table's RLS.
create or replace function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

revoke execute on function public.current_user_school_id() from public, anon;
grant execute on function public.current_user_school_id() to authenticated;

-- 1. profiles
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Users can view same-school profiles" on public.profiles
for select to authenticated
using (
  auth.uid() = id
  or has_role(auth.uid(), 'system_admin')
  or (school_id is not null and school_id = public.current_user_school_id())
);

-- 2. user_roles (no school_id column of its own - join through profiles)
drop policy if exists "Anyone can view roles" on public.user_roles;
create policy "Users can view same-school roles" on public.user_roles
for select to authenticated
using (
  user_id = auth.uid()
  or has_role(auth.uid(), 'system_admin')
  or exists (
    select 1 from public.profiles target
    where target.id = user_roles.user_id
      and target.school_id = public.current_user_school_id()
  )
);

-- 3. classes
drop policy if exists "Classes are viewable by everyone" on public.classes;
create policy "Classes viewable within own school" on public.classes
for select to authenticated
using (school_id = public.current_user_school_id());

-- 4. lessons
drop policy if exists "Staff can view lessons" on public.lessons;
create policy "Staff can view own-school lessons" on public.lessons
for select to authenticated
using (
  (has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'management') or has_role(auth.uid(),'educator') or has_role(auth.uid(),'grade_coordinator'))
  and school_id = public.current_user_school_id()
);

-- 5. attendance
drop policy if exists "Staff can view attendance" on public.attendance;
create policy "Staff can view own-school attendance" on public.attendance
for select to authenticated
using (
  (has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'management') or has_role(auth.uid(),'educator'))
  and exists (select 1 from public.profiles st where st.id = attendance.student_id and st.school_id = public.current_user_school_id())
);

drop policy if exists "Counselors can view attendance" on public.attendance;
create policy "Counselors can view own-school attendance" on public.attendance
for select to authenticated
using (
  has_role(auth.uid(),'counselor')
  and exists (select 1 from public.profiles st where st.id = attendance.student_id and st.school_id = public.current_user_school_id())
);

-- 6. lesson_notes
drop policy if exists "Staff can view lesson notes" on public.lesson_notes;
create policy "Staff can view own-school lesson notes" on public.lesson_notes
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and exists (select 1 from public.profiles st where st.id = lesson_notes.student_id and st.school_id = public.current_user_school_id())
);

drop policy if exists "Counselors can view lesson notes" on public.lesson_notes;
create policy "Counselors can view own-school lesson notes" on public.lesson_notes
for select to authenticated
using (
  has_role(auth.uid(),'counselor')
  and exists (select 1 from public.profiles st where st.id = lesson_notes.student_id and st.school_id = public.current_user_school_id())
);

-- 7. assignments
drop policy if exists "Staff can view assignments" on public.assignments;
create policy "Staff can view own-school assignments" on public.assignments
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and school_id = public.current_user_school_id()
);

-- 8. submissions
drop policy if exists "Staff can view submissions" on public.submissions;
create policy "Staff can view own-school submissions" on public.submissions
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and exists (select 1 from public.profiles st where st.id = submissions.student_id and st.school_id = public.current_user_school_id())
);

drop policy if exists "Counselors can view submissions" on public.submissions;
create policy "Counselors can view own-school submissions" on public.submissions
for select to authenticated
using (
  has_role(auth.uid(),'counselor')
  and exists (select 1 from public.profiles st where st.id = submissions.student_id and st.school_id = public.current_user_school_id())
);

-- 9. focus_reports
drop policy if exists "Staff can view focus reports" on public.focus_reports;
create policy "Staff can view own-school focus reports" on public.focus_reports
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and exists (select 1 from public.profiles st where st.id = focus_reports.student_id and st.school_id = public.current_user_school_id())
);

drop policy if exists "Counselors can view focus reports" on public.focus_reports;
create policy "Counselors can view own-school focus reports" on public.focus_reports
for select to authenticated
using (
  has_role(auth.uid(),'counselor')
  and exists (select 1 from public.profiles st where st.id = focus_reports.student_id and st.school_id = public.current_user_school_id())
);

-- 10. task_questions
drop policy if exists "Staff can view task questions" on public.task_questions;
create policy "Staff can view own-school task questions" on public.task_questions
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'grade_coordinator'))
  and exists (select 1 from public.assignments a where a.id = task_questions.assignment_id and a.school_id = public.current_user_school_id())
);

-- 11. counselor_cases
drop policy if exists "Management can view case status" on public.counselor_cases;
create policy "Management can view own-school case status" on public.counselor_cases
for select to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
);

-- 12. payment_items
drop policy if exists "Authenticated can view payment items" on public.payment_items;
create policy "Own-school users can view payment items" on public.payment_items
for select to authenticated
using (school_id = public.current_user_school_id());

-- 13. payment_records
drop policy if exists "Management can manage payment records" on public.payment_records;
create policy "Management can manage own-school payment records" on public.payment_records
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.profiles st where st.id = payment_records.student_id and st.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.profiles st where st.id = payment_records.student_id and st.school_id = public.current_user_school_id()))
);

-- 14. support_tickets
drop policy if exists "Management can view and resolve all tickets" on public.support_tickets;
create policy "Management can view and resolve own-school tickets" on public.support_tickets
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
);

-- 15. exam_archive
drop policy if exists "Authenticated can view exam archive" on public.exam_archive;
create policy "Own-school users can view exam archive" on public.exam_archive
for select to authenticated
using (school_id = public.current_user_school_id());

-- 16. teacher_classes
drop policy if exists "Teacher classes viewable by authenticated" on public.teacher_classes;
create policy "Teacher classes viewable within own school" on public.teacher_classes
for select to authenticated
using (
  exists (select 1 from public.classes c where c.id = teacher_classes.class_id and c.school_id = public.current_user_school_id())
);

-- 17. grade_events
drop policy if exists "Staff can view grade events" on public.grade_events;
create policy "Staff can view own-school grade events" on public.grade_events
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'professional_teacher') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'counselor'))
  and school_id = public.current_user_school_id()
);

-- 18. event_approvals
drop policy if exists "Staff can view event approvals" on public.event_approvals;
create policy "Staff can view own-school event approvals" on public.event_approvals
for select to authenticated
using (
  (has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'educator'))
  and exists (select 1 from public.profiles st where st.id = event_approvals.student_id and st.school_id = public.current_user_school_id())
);

-- 19. tutoring_sessions
drop policy if exists "Coordinators can manage tutoring sessions" on public.tutoring_sessions;
create policy "Coordinators can manage own-school tutoring sessions" on public.tutoring_sessions
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
);

drop policy if exists "Teachers can view assigned tutoring" on public.tutoring_sessions;
create policy "Teachers can view own-school tutoring" on public.tutoring_sessions
for select to authenticated
using (
  teacher_id = auth.uid()
  or (has_role(auth.uid(),'educator') and school_id = public.current_user_school_id())
);

-- 20. tutoring_students
drop policy if exists "Coordinators can manage tutoring students" on public.tutoring_students;
create policy "Coordinators can manage own-school tutoring students" on public.tutoring_students
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management'))
      and exists (select 1 from public.tutoring_sessions ts where ts.id = tutoring_students.session_id and ts.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management'))
      and exists (select 1 from public.tutoring_sessions ts where ts.id = tutoring_students.session_id and ts.school_id = public.current_user_school_id()))
);

-- 21. staff_meetings
drop policy if exists "Coordinators can manage staff meetings" on public.staff_meetings;
create policy "Coordinators can manage own-school staff meetings" on public.staff_meetings
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
);

drop policy if exists "Staff can view meetings" on public.staff_meetings;
create policy "Staff can view own-school meetings" on public.staff_meetings
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'professional_teacher') or has_role(auth.uid(),'counselor'))
  and school_id = public.current_user_school_id()
);

-- 22. meeting_attendees
drop policy if exists "Coordinators can manage meeting attendees" on public.meeting_attendees;
create policy "Coordinators can manage own-school meeting attendees" on public.meeting_attendees
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management'))
      and exists (select 1 from public.staff_meetings sm where sm.id = meeting_attendees.meeting_id and sm.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'subject_coordinator') or has_role(auth.uid(),'management'))
      and exists (select 1 from public.staff_meetings sm where sm.id = meeting_attendees.meeting_id and sm.school_id = public.current_user_school_id()))
);

-- 23. grade_announcements
drop policy if exists "Coordinators can manage announcements" on public.grade_announcements;
create policy "Coordinators can manage own-school announcements" on public.grade_announcements
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
);

drop policy if exists "Authenticated users can view published announcements" on public.grade_announcements;
create policy "Users can view own-school published announcements" on public.grade_announcements
for select to authenticated
using (published = true and school_id = public.current_user_school_id());

-- 24. student_tracks
drop policy if exists "Staff can view all tracks" on public.student_tracks;
create policy "Staff can view own-school tracks" on public.student_tracks
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'grade_coordinator'))
  and school_id = public.current_user_school_id()
);

drop policy if exists "Staff can update tracks" on public.student_tracks;
create policy "Staff can update own-school tracks" on public.student_tracks
for update to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'educator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'educator') or has_role(auth.uid(),'management')) and school_id = public.current_user_school_id())
);

-- 25. student_seats
drop policy if exists "Staff can manage seats" on public.student_seats;
create policy "Staff can manage own-school seats" on public.student_seats
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'management') or has_role(auth.uid(),'educator') or has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'counselor'))
      and exists (select 1 from public.classes c where c.id = student_seats.class_id and c.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'management') or has_role(auth.uid(),'educator') or has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'counselor'))
      and exists (select 1 from public.classes c where c.id = student_seats.class_id and c.school_id = public.current_user_school_id()))
);

-- 26. meeting_slots
drop policy if exists "Authenticated can view meeting slots" on public.meeting_slots;
create policy "Own-school users can view meeting slots" on public.meeting_slots
for select to authenticated
using (school_id = public.current_user_school_id());

-- 27. faq_items (school_id NULL = global by design - keep those visible everywhere)
drop policy if exists "Authenticated can view faq items" on public.faq_items;
create policy "Users can view global and own-school faq items" on public.faq_items
for select to authenticated
using (school_id is null or school_id = public.current_user_school_id());

-- 28. system_announcements (school_id NULL = platform-wide by design)
drop policy if exists "Authenticated can view announcements" on public.system_announcements;
create policy "Users can view platform-wide and own-school announcements" on public.system_announcements
for select to authenticated
using (school_id is null or school_id = public.current_user_school_id());
