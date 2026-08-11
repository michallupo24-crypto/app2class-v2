-- Task IDE & Sandbox (spec: "סביבת הפיתוח למשימות אינטראקטיביות"). Replaces the
-- BlankHtmlMode hack of JSON-stringifying {type:"blank-html", code} into
-- assignments.description with a real table. Ported from a standalone prototype
-- (Monaco editor + Pyodide sandbox + AI generate/debug) built against an in-memory
-- Express "database" — this migration is the real persistence layer for it.

create table public.interactive_tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  school_id uuid references public.schools(id),
  title text not null default 'משימה אינטראקטיבית',
  description text,
  subject text,
  grade_level text,
  language text not null default 'web' check (language in ('web', 'python')),
  html_code text not null default '',
  css_code text not null default '',
  js_code text not null default '',
  python_code text not null default '',
  libraries text[] not null default '{}',
  grading_schema jsonb,
  is_public_template boolean not null default false,
  forked_from uuid references public.interactive_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_interactive_tasks_assignment on public.interactive_tasks(assignment_id);
create index idx_interactive_tasks_author on public.interactive_tasks(author_id);
create index idx_interactive_tasks_public on public.interactive_tasks(is_public_template) where is_public_template = true;

alter table public.interactive_tasks enable row level security;

create policy "Authors manage their own interactive tasks" on public.interactive_tasks
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Any teacher can browse+fork public gallery templates (read-only on someone else's row)
create policy "Teachers can view public template tasks" on public.interactive_tasks
  for select to authenticated
  using (is_public_template = true);

-- Students need to read the compiled task for an assignment they can already see
create policy "Students can view tasks for their assignments" on public.interactive_tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.profiles p on p.class_id = a.class_id
      where a.id = interactive_tasks.assignment_id and p.id = auth.uid()
    )
  );

create trigger update_interactive_tasks_updated_at
  before update on public.interactive_tasks
  for each row execute function public.update_updated_at_column();

-- Per-student progress/state (the postMessage 'state-save' + 'time-tick' contract)
create table public.interactive_task_progress (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.interactive_tasks(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  state jsonb,
  score numeric,
  total numeric,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  time_spent_seconds integer not null default 0,
  last_active_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (task_id, student_id)
);

alter table public.interactive_task_progress enable row level security;

create policy "Students manage their own task progress" on public.interactive_task_progress
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "Task authors can view student progress" on public.interactive_task_progress
  for select to authenticated
  using (
    exists (
      select 1 from public.interactive_tasks it
      where it.id = interactive_task_progress.task_id and it.author_id = auth.uid()
    )
  );
