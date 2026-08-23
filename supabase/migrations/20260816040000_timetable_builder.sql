-- Smart Timetable Builder: school day config, subject-hour requirements (with
-- principal approval gate), rooms, and hard no-double-booking guarantees for
-- teachers and rooms on timetable_slots.
--
-- Also closes a cross-school RLS gap flagged (but deliberately deferred) in
-- 20260813000000_scope_school_rls.sql: bell_schedule and timetable_slots were
-- previously readable/writable by role alone, with no check that the viewer
-- belongs to the same school as the row. Since this migration is already
-- adding first-class policies for the new timetable tables, it scopes those
-- two existing tables the same way, using the same current_user_school_id()
-- helper introduced in that migration.

-- 1. school_timetable_settings: one row per school, day-of-week config + the
--    "has the principal approved the subject-hours template" gate.
create table public.school_timetable_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  days_of_week smallint[] not null default '{0,1,2,3,4}',
  hours_template_approved boolean not null default false,
  hours_template_approved_by uuid,
  hours_template_approved_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.school_timetable_settings enable row level security;

create policy "Same-school users can view timetable settings" on public.school_timetable_settings
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school timetable settings" on public.school_timetable_settings
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
);

-- 2. subject_requirements: weekly-hour requirement per subject, per grade
--    (class_id null = grade-wide default) or per specific class override.
create table public.subject_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade grade_level not null,
  class_id uuid references public.classes(id) on delete cascade,
  subject text not null,
  weekly_hours smallint not null check (weekly_hours > 0),
  block_size smallint not null default 2 check (block_size > 0),
  group_count smallint not null default 1 check (group_count > 0),
  preferred_room_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, grade, class_id, subject)
);

alter table public.subject_requirements enable row level security;

create policy "Same-school staff can view subject requirements" on public.subject_requirements
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school subject requirements" on public.subject_requirements
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
);

-- 3. rooms: the school's physical rooms.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  room_type text not null default 'כיתה',
  capacity smallint,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

alter table public.rooms enable row level security;

create policy "Same-school staff can view rooms" on public.rooms
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school rooms" on public.rooms
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
);

-- 4. timetable_slots: hard guarantees that a class, a teacher, or a room can
--    never be double-booked into the same day/period. A class CAN have more
--    than one row at the same day/period only when group_name is set (a
--    same-time split into parallel ability/elective groups) - each group
--    still needs its own distinct group_name, enforced by the second index.
create unique index timetable_slots_class_slot_unique on public.timetable_slots
  (school_id, class_id, day_of_week, lesson_number) where group_name is null;
create unique index timetable_slots_class_slot_group_unique on public.timetable_slots
  (school_id, class_id, day_of_week, lesson_number, group_name) where group_name is not null;

create unique index timetable_slots_teacher_slot_unique on public.timetable_slots
  (school_id, teacher_id, day_of_week, lesson_number) where teacher_id is not null;

create unique index timetable_slots_room_slot_unique on public.timetable_slots
  (school_id, room, day_of_week, lesson_number) where room is not null;

-- 5. Close the deferred cross-school gap on bell_schedule and timetable_slots.
drop policy if exists "Bell schedule viewable by all authenticated" on public.bell_schedule;
create policy "Bell schedule viewable within own school" on public.bell_schedule
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

drop policy if exists "Admin can manage bell schedule" on public.bell_schedule;
create policy "Admin can manage own-school bell schedule" on public.bell_schedule
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'management') or has_role(auth.uid(), 'grade_coordinator'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'management') or has_role(auth.uid(), 'grade_coordinator'))
      and school_id = public.current_user_school_id())
);

drop policy if exists "Timetable viewable by all authenticated" on public.timetable_slots;
create policy "Timetable viewable within own school" on public.timetable_slots
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

drop policy if exists "Admin can manage timetable" on public.timetable_slots;
create policy "Admin can manage own-school timetable" on public.timetable_slots
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'management') or has_role(auth.uid(), 'grade_coordinator'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'management') or has_role(auth.uid(), 'grade_coordinator'))
      and school_id = public.current_user_school_id())
);
