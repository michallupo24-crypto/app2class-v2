-- subject_requirements' own unique constraint is (school_id, grade, class_id,
-- subject), but Postgres treats NULL class_id as distinct from every other
-- NULL for uniqueness purposes - so nothing ever stopped two grade-wide
-- default rows (class_id null) for the same (school, grade, subject) from
-- coexisting. In practice this happened via the "add subject" form in
-- SubjectRequirementsEditor, which lets a coordinator add a subject already
-- covered by the seeded/edited grade default. The generator's requirement
-- resolver picks whichever row happens to come back last from the DB for
-- that key (Map.set overwrite), so which one "wins" - hours, block size,
-- is_grade_wide - became arbitrary and silently inconsistent with what's
-- shown as the grade default in the UI.
-- Dedupe existing accidental duplicates before the index can be created:
-- keep the earliest-created row per (school, grade, subject) grade-default
-- group, drop the rest.
delete from public.subject_requirements a
using public.subject_requirements b
where a.class_id is null
  and b.class_id is null
  and a.school_id = b.school_id
  and a.grade = b.grade
  and a.subject = b.subject
  and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

create unique index subject_requirements_grade_default_unique
  on public.subject_requirements (school_id, grade, subject)
  where class_id is null;
