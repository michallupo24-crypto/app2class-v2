-- Tracks/electives (מגמות): unlike a grade-wide subject (one subject, every
-- class simultaneously), a track block is several DIFFERENT subjects offered
-- at the exact same shared slot across the whole grade - students from every
-- home class regroup by their own track choice. Rows that share the same
-- (school_id, grade, track_group) are the option set for one such block; the
-- generator places them together as one atomic unit, each option getting its
-- own teacher/room, matching the app's existing group_name-per-track display
-- convention (see student_tracks / WeeklyTimetable "pickSlot").
alter table public.subject_requirements
  add column track_group text;
