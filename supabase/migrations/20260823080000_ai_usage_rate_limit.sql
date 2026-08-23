-- Per-user usage log for AI-calling edge functions (ai-tutor, task-studio-ai),
-- used to enforce a basic rate limit and prevent unbounded LLM API cost abuse
-- from a single account. Written by edge functions using the service-role key.
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  function_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_log_user_time
  on public.ai_usage_log (user_id, created_at desc);

alter table public.ai_usage_log enable row level security;

-- No client-facing policies: only the service-role key (used inside the
-- edge functions) reads/writes this table, so RLS is enabled but no
-- policy grants access to `authenticated`/`anon`, closing it by default.

-- Periodically prune old rows so the table doesn't grow unbounded.
create or replace function public.prune_ai_usage_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_usage_log where created_at < now() - interval '2 days';
$$;
