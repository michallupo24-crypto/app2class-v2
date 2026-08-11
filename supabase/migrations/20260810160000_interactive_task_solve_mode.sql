-- Adds the second IDE use case from the spec ("Advanced AI Task Builder" ->
-- IDE Integrated for CS teachers): the STUDENT writes real code as their answer,
-- instead of just consuming a teacher-built interactive page. Reuses the existing
-- interactive_tasks/interactive_task_progress tables and the same sandbox/postMessage
-- pipeline — 'solve' tasks just mean python_code holds the teacher's starter/skeleton
-- code, and each student's own written code lives in interactive_task_progress.state
-- (jsonb, no schema change needed there).

alter table public.interactive_tasks
  add column mode text not null default 'consume' check (mode in ('consume', 'solve'));
