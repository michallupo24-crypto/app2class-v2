-- Teacher scheduling constraints (אילוצים): the generator previously only
-- accepted a transient in-memory `unavailable` set built by the caller for
-- one run - nothing about a teacher's recurring unavailability, staff
-- meetings, or continuity requests was ever persisted. This table is a
-- generic home for every constraint type the timetable builder needs to
-- know about, rather than one bespoke table per type.
create table public.teacher_constraints (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  constraint_type text not null check (constraint_type in (
    'unavailable_slot',       -- fixed day+lesson the teacher is never available
    'staff_meeting',          -- fixed day+lesson reserved for a recurring meeting
    'date_range_unavailable', -- a leave/medical date range, not slot-specific
    'continue_with_class',    -- request that the same teacher keeps class+subject from last year
    'no_edge_lesson',         -- don't schedule this teacher in the first/last lesson of the day
    'max_daily_hours',        -- cap on how many lessons this teacher can teach in one day
    'custom'
  )),
  day_of_week smallint check (day_of_week between 0 and 6),
  lesson_number smallint,
  start_date date,
  end_date date,
  class_id uuid references public.classes(id) on delete cascade,
  subject text,
  max_value smallint,
  -- Hard constraints block the generator/manual-edit outright; soft ones are
  -- a preference the generator tries to honor but can override if it has to.
  is_hard boolean not null default true,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz
);

create index idx_teacher_constraints_school on public.teacher_constraints (school_id);
create index idx_teacher_constraints_teacher on public.teacher_constraints (teacher_id);

alter table public.teacher_constraints enable row level security;

create policy "Same-school staff can view teacher constraints" on public.teacher_constraints
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

-- Any coordinator/management can create or edit a constraint's scheduling
-- fields, but approving/rejecting a 'continue_with_class' request (or any
-- other pending request) needs to stay possible even for the same roles -
-- status is not singled out here the way hours_template_approved is,
-- because unlike the single school-wide hours gate, each constraint is its
-- own row that a grade_coordinator may legitimately need to approve or
-- reject on management's behalf. Tightening this further (e.g. only
-- management/system_admin can flip status) can be layered on later if a
-- school actually needs it enforced at the DB level.
create policy "Coordinators can manage own-school teacher constraints" on public.teacher_constraints
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
