-- Task Studio audit found three teacher-facing panels that write settings
-- nobody ever reads back: the "schedule & lock" panel (ManualQuestionEditor,
-- duplicated in the unreachable ScheduleLockMode), and Data Hook
-- (DataHookMode). Both stuffed their settings into assignments.description as
-- JSON, silently clobbering each other and any human-written description.
-- This migration gives each setting a real, dedicated column, and adds the
-- submission-side columns needed to make "one attempt", "shuffle", and
-- Data Hook's attempt/time tracking actually mean something.

alter table public.assignments
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists lock_device boolean not null default false,
  add column if not exists lock_duration_minutes int,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false,
  add column if not exists one_attempt boolean not null default false,
  add column if not exists data_hook_auto_grade boolean not null default true,
  add column if not exists data_hook_include_attempts boolean not null default false,
  add column if not exists data_hook_include_time boolean not null default true;

alter table public.submissions
  add column if not exists attempt_number int not null default 1,
  add column if not exists time_spent_seconds int,
  add column if not exists focus_violations int not null default 0;

-- Same reasoning as process_due_scheduled_messages
-- (20260823010000_chat_groups_and_scheduling.sql): there's no pg_cron in this
-- project, so "publish this assignment at a future date" is delivered by a
-- SECURITY DEFINER function the client calls opportunistically on auth
-- refresh (see src/hooks/useAuth.tsx), scoped to the calling teacher's own
-- assignments. If the teacher never reopens the app after the scheduled
-- time, publishing won't happen until they do - an accepted limits-of-the-
-- infra tradeoff, matching the existing scheduled-chat-message behavior.
create or replace function public.publish_due_scheduled_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  update public.assignments
    set published = true, scheduled_publish_at = null
    where teacher_id = auth.uid()
      and published = false
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.publish_due_scheduled_assignments() from public, anon;
