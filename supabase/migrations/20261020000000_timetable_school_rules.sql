-- School-level timetable rules for the generator, next to the per-teacher
-- teacher_constraints:
--   shortDays        { "<day_of_week>": <last lesson_number> }  e.g. Friday until 5
--   subjectEarliest  { "<subject>": <first allowed lesson_number> }  e.g. PE not in lesson 1
--   subjectLatest    { "<subject>": <last allowed lesson_number> }
--   morningSubjects  [ "<subject>", ... ]  soft: prefer the first lessons
alter table public.school_timetable_settings
  add column if not exists rules jsonb not null default '{}'::jsonb;

comment on column public.school_timetable_settings.rules is
  'Timetable generator rules: shortDays, subjectEarliest, subjectLatest, morningSubjects.';
