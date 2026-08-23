-- DocWord Hybrid document editor: per-user documents, synced across devices.
-- Comments/suggestions/history are stored as jsonb rather than normalized
-- tables since they're always read/written as a whole with the document
-- and have no independent query pattern of their own.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'מסמך ללא שם',
  content_html text not null default '',
  language text not null default 'he',
  dir text not null default 'rtl',
  view_mode text not null default 'paged',
  doc_mode text not null default 'editing',
  comments jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  header_text text not null default '',
  footer_text text not null default '',
  show_page_numbers boolean not null default true,
  page_number_position text,
  page_number_format text,
  page_bg_color text not null default '#ffffff',
  watermark_text text not null default '',
  font_family text not null default 'Rubik',
  font_size text not null default '16px',
  line_spacing text not null default '1.5',
  margins jsonb not null default '{"top":25,"bottom":25,"left":25,"right":25}'::jsonb,
  zoom integer not null default 100,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  custom_dictionary text[] not null default '{}',
  ignored_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_owner on public.documents (owner_id, updated_at desc);

alter table public.documents enable row level security;

-- Owner-only access: this is a private per-user editor for now (not a
-- collaborative/shared-document feature - the in-app "share" dialog is
-- UI-only and doesn't grant real access to other accounts).
create policy "Users manage their own documents"
  on public.documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger set_documents_updated_at
  before update on public.documents
  for each row
  execute function public.update_updated_at_column();
