-- Two real gaps in how tracks/electives (מגמות) and ability-groups (הקבצות)
-- work, both reported directly by a school using this:
--
-- 1. הקבצות (ability groups, e.g. מתמטיקה 5/4/3 יח"ל) need to pool students
--    from ACROSS every home class in the grade into level-based groups, not
--    stay grouped by home class. The existing track_group mechanism (used
--    for מגמות) already does exactly this - several rows sharing one
--    (school, grade, track_group) are placed as one shared grade-wide slot,
--    each option getting its own teacher/room. A הקבצה is modeled the same
--    way: each level becomes its own subject_requirements row whose
--    `subject` is level-qualified (e.g. "מתמטיקה (5 יח\"ל)") so the options
--    stay distinct, sharing one track_group (e.g. "מתמטיקה - הקבצות").
--    track_kind + base_subject just let the UI (and reporting) tell a
--    הקבצה apart from an ordinary מגמה and recover the plain subject name.
--
-- 2. מגמות need a real cluster (אשכול) grouping - "אשכול א'" containing many
--    subject options - which track_group already represents (one track_group
--    = one shared-slot cluster). What was missing was making that
--    school-configurable instead of two hardcoded clusters in constants.ts,
--    and letting the registration wizard read the actual choices a
--    coordinator set up for that grade instead of a static list.
alter table public.subject_requirements
  add column track_kind text check (track_kind in ('megama', 'hakbatza')),
  add column base_subject text;

-- The student registration wizard signs the user up only at its very last
-- step - every earlier step, including track/הקבצה selection, runs with no
-- session yet. Track offerings aren't sensitive (they're the published
-- elective/level choices for prospective students), so let anon read just
-- the track_group-tagged rows - everything else in this table (regular
-- weekly-hour requirements) stays staff-only via the existing policy.
create policy "Anyone can view track offerings for registration" on public.subject_requirements
for select to anon
using (track_group is not null);

-- student_tracks previously modeled clusters as two hardcoded track_type
-- values (megama_a/megama_b), capping every school at exactly two clusters.
-- cluster_name generalizes this to however many clusters a school actually
-- defines; base_subject mirrors the same field on subject_requirements so a
-- הקבצה selection can be grouped by its plain subject name.
alter table public.student_tracks
  add column cluster_name text,
  add column base_subject text;
