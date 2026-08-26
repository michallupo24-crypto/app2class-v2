-- Class-scoped, view-only presentation sharing: one row = "shared with
-- this whole class", not one row per student (simpler than documents'
-- per-user-by-email document_shares, and avoids that table's circular-RLS
-- bug since presentation_shares' own policies never reference
-- `presentations` back - see the "self-contained" note below).
create table public.presentation_shares (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (presentation_id, class_id)
);

create index idx_presentation_shares_presentation on public.presentation_shares (presentation_id);
create index idx_presentation_shares_class on public.presentation_shares (class_id);

alter table public.presentation_shares enable row level security;

-- Self-contained (no reference to `presentations`) so it can't recreate
-- the FOR-ALL circular-RLS bug that document_shares hit and had to fix
-- in 20260823120000_fix_document_shares_rls_recursion.sql.
create policy "Sharer or classmate can view a share row"
  on public.presentation_shares for select
  using (
    shared_by = auth.uid()
    or class_id = (select class_id from public.profiles where id = auth.uid())
  );

create policy "Only the presentation owner can create a share"
  on public.presentation_shares for insert
  with check (
    shared_by = auth.uid()
    and exists (select 1 from public.presentations p where p.id = presentation_id and p.owner_id = auth.uid())
  );

create policy "Only the sharer can delete a share"
  on public.presentation_shares for delete
  using (shared_by = auth.uid());

-- Purely additive alongside the existing owner-only FOR ALL policy on
-- presentations (20260826010000) - Postgres ORs permissive SELECT
-- policies together, so this doesn't need to touch that policy.
create policy "Class-shared student can view a presentation"
  on public.presentations for select
  using (
    exists (
      select 1 from public.presentation_shares ps
      where ps.presentation_id = presentations.id
        and ps.class_id = (select class_id from public.profiles where id = auth.uid())
    )
  );
