-- How many teachers the school has per subject (school-wide, not per grade).
-- Used by the timetable generator as a capacity cap: at most this many
-- classes can have the subject scheduled at the exact same day/period across
-- the whole school, even before real teachers are individually assigned via
-- teacher_classes. Synthetic placeholder teacher identities ("<subject> -
-- מורה N") are derived from this count at generation time.
create table public.subject_teacher_counts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject text not null,
  teacher_count smallint not null check (teacher_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, subject)
);

alter table public.subject_teacher_counts enable row level security;

create policy "Same-school staff can view teacher counts" on public.subject_teacher_counts
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school teacher counts" on public.subject_teacher_counts
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
