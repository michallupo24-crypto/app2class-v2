-- A school's first year using this system has no history stored anywhere in
-- it - teacher_classes only ever represents the CURRENT year's assignments,
-- and no school_year/academic_year column exists on any table. So "keep last
-- year's teacher for grades ז'-י"א" can't be inferred automatically; the
-- school has to enter it once, manually, and every such carried-over
-- assignment needs an explicit per-teacher approval (not a single school-wide
-- flag like hours_template_approved) before the generator treats it as a
-- preference - see teacher_constraints.constraint_type = 'continue_with_class'.
create table public.teacher_class_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_year_label text not null,
  entered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (school_id, class_id, subject, school_year_label)
);

create index idx_teacher_class_history_school on public.teacher_class_history (school_id);

alter table public.teacher_class_history enable row level security;

create policy "Same-school staff can view teacher class history" on public.teacher_class_history
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school teacher class history" on public.teacher_class_history
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

alter table public.school_timetable_settings
  add column continuity_setup_completed boolean not null default false;
