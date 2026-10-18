-- Read access found missing in the 18.10.2026 role-by-role test.
-- All policies are additive (SELECT only) and scoped to the reader's school.

-- 1. lessons
-- Students and parents could read their attendance rows but not the lessons
-- they belong to, so the attendance page showed "Invalid Date" and a 100%
-- attendance rate (the lesson count came back 0). Counselors and subject
-- coordinators hit the same wall when computing absence patterns.
drop policy if exists "Students can view own class lessons" on public.lessons;
create policy "Students can view own class lessons" on public.lessons
for select to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.class_id = lessons.class_id
  )
);

drop policy if exists "Parents can view children's lessons" on public.lessons;
create policy "Parents can view children's lessons" on public.lessons
for select to authenticated
using (
  exists (
    select 1 from public.parent_student ps
    join public.profiles child on child.id = ps.student_id
    where ps.parent_id = auth.uid() and child.class_id = lessons.class_id
  )
);

drop policy if exists "Counselors and coordinators can view own-school lessons" on public.lessons;
create policy "Counselors and coordinators can view own-school lessons" on public.lessons
for select to authenticated
using (
  (has_role(auth.uid(), 'counselor') or has_role(auth.uid(), 'subject_coordinator'))
  and school_id = public.current_user_school_id()
);

-- 2. attendance
-- The grade coordinator's "grade pulse" showed 100% and "no attendance data".
drop policy if exists "Grade coordinators can view own-school attendance" on public.attendance;
create policy "Grade coordinators can view own-school attendance" on public.attendance
for select to authenticated
using (
  has_role(auth.uid(), 'grade_coordinator')
  and exists (
    select 1 from public.profiles st
    where st.id = attendance.student_id and st.school_id = public.current_user_school_id()
  )
);

drop policy if exists "Parents can view children's attendance" on public.attendance;
create policy "Parents can view children's attendance" on public.attendance
for select to authenticated
using (
  exists (
    select 1 from public.parent_student ps
    where ps.parent_id = auth.uid() and ps.student_id = attendance.student_id
  )
);

-- 3. grade_events
-- Approved exams, trips and ceremonies are the school calendar. Parents could
-- not see the annual trip that needs their signature, so nobody could sign.
drop policy if exists "School members can view approved grade events" on public.grade_events;
create policy "School members can view approved grade events" on public.grade_events
for select to authenticated
using (
  status = 'approved'
  and school_id = public.current_user_school_id()
);
