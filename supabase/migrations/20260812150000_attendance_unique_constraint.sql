-- Critical bug found via live testing: RollCallPage.performSave and
-- useSmartSeat.cycleAttendance both upsert into attendance with
-- onConflict: 'student_id,lesson_id', but this table never had a unique
-- constraint on those columns - only a primary key on id and a FK on
-- lesson_id. Every save has been failing with "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification" - the
-- core attendance-taking feature has never actually persisted data.
-- Verified no existing duplicate (student_id, lesson_id) rows before adding.

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_lesson_unique UNIQUE (student_id, lesson_id);
