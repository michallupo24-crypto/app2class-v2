-- Some subjects (classically מתמטיקה/אנגלית, taught in cross-class ability
-- groups/הקבצות, and track/elective periods) can't be scheduled independently
-- per class - every class in the grade needs the exact same day/period free
-- so students can regroup across their home classes. This flag lets a
-- coordinator mark a subject_requirements row (always a grade-wide default
-- row, class_id is null) as needing that simultaneous placement.
alter table public.subject_requirements
  add column is_grade_wide boolean not null default false;
