-- Gap: a grade-wide subject (is_grade_wide) has no way to be split into
-- cross-class ability groups while keeping ONE reported subject name (e.g.
-- "the whole grade has English at the same slot, split into 3 level groups
-- with 3 different teachers, but it's still just 'אנגלית' in every report").
-- is_grade_wide itself ignores group_count entirely (see timetableGenerator.ts),
-- and subject_requirements_grade_default_unique blocks inserting a second
-- grade-default row for the same subject outright.
--
-- track_group already implements the exact placement mechanics needed (one
-- shared slot across the whole grade, each option its own teacher/room) - the
-- existing הקבצה (hakbatza) flow just repurposes it by composing a distinct
-- subject string per level ("מתמטיקה (5 יח\"ל)"), which is fine when the
-- levels really are reported separately, but wrong when the ability groups
-- should all roll up under one plain subject name. Add a third track_kind,
-- 'ability_group', where every option keeps subject = base_subject and is
-- distinguished only by a new group_label column (e.g. "קבוצה א'").
alter table public.subject_requirements
  drop constraint subject_requirements_track_kind_check,
  add constraint subject_requirements_track_kind_check
    check (track_kind in ('megama', 'hakbatza', 'ability_group')),
  add column group_label text;

-- subject_requirements_grade_default_unique (school_id, grade, subject) where
-- class_id is null would otherwise reject a second ability_group option row,
-- since (unlike megama/hakbatza) its subject is intentionally identical
-- across every option in the block. Track rows already need their own
-- uniqueness guard independent of this one (nothing previously enforced "no
-- duplicate option within the same block" beyond subject text happening to
-- differ) - so exclude track rows from the grade-default index and add a
-- dedicated one keyed by (track_group, subject, group_label) instead.
drop index public.subject_requirements_grade_default_unique;

create unique index subject_requirements_grade_default_unique
  on public.subject_requirements (school_id, grade, subject)
  where class_id is null and track_group is null;

create unique index subject_requirements_track_option_unique
  on public.subject_requirements (school_id, grade, track_group, subject, group_label)
  where track_group is not null;
