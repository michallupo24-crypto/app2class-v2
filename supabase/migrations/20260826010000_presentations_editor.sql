-- Presentations MVP: per-user slide decks, owner-only (no classroom sharing
-- yet). Slides (and each slide's objects) are stored as a single jsonb array
-- on the presentation row, mirroring the documents.comments/suggestions/
-- history pattern - always read/written as a whole via debounced autosave,
-- no independent per-slide query pattern in this first slice.
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'מצגת ללא שם',
  slides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_presentations_owner on public.presentations (owner_id, updated_at desc);

alter table public.presentations enable row level security;

create policy "Users manage their own presentations"
  on public.presentations for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger set_presentations_updated_at
  before update on public.presentations
  for each row
  execute function public.update_updated_at_column();
