-- Backing schema for two new Task Studio template types:
-- 1. "מסלול מותאם אישית" (adaptive tiers) - task_questions can be tagged with a
--    difficulty tier; students are routed to their tier client-side based on
--    their own subject history, so a single published assignment auto-adapts
--    with zero manual roster work for the teacher.
-- 2. "בוחן עם מאמן AI" (misconception coach) - task_questions can opt into
--    live wrong-answer coaching; question_misconceptions logs what the AI
--    diagnosed so the teacher gets a real, non-fabricated reteaching report.

alter table public.task_questions
  add column if not exists tier text check (tier in ('support','standard','challenge')),
  add column if not exists coaching_enabled boolean not null default false;

create table if not exists public.question_misconceptions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.task_questions(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) default public.current_user_school_id(),
  student_answer text,
  misconception_label text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_question_misconceptions_assignment on public.question_misconceptions(assignment_id);
create index if not exists idx_question_misconceptions_student on public.question_misconceptions(student_id);

alter table public.question_misconceptions enable row level security;

-- Students log/view only their own coaching events.
create policy "Students manage own misconceptions" on public.question_misconceptions
for all to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- The owning teacher, or same-school management/grade_coordinator/system_admin,
-- can see the aggregate report - scoped exactly like the 2026-08-13 RLS audit's
-- pattern (own assignment, or same current_user_school_id()), not role-only.
create policy "Staff can view own-school misconceptions" on public.question_misconceptions
for select to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or exists (select 1 from public.assignments a where a.id = question_misconceptions.assignment_id and a.teacher_id = auth.uid())
  or ((has_role(auth.uid(), 'management') or has_role(auth.uid(), 'grade_coordinator')) and school_id = public.current_user_school_id())
);
