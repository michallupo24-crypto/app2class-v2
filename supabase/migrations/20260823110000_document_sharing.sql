-- Real document sharing for the DocWord editor (documents table added in
-- 20260823100000_documents_editor.sql). Invite-by-email, scoped to the
-- inviter's own school, with three permission levels.
-- shared_with_user_id/created_by reference public.profiles (not auth.users
-- directly) so PostgREST can embed the sharee's profile in a select() -
-- see 20260405120000_chat_participant_profile_fkeys.sql, which hit the same
-- issue with conversation_participants/messages and fixed it the same way.
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null default 'viewer' check (permission in ('editor', 'commenter', 'viewer')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (document_id, shared_with_user_id)
);

create index if not exists idx_document_shares_document on public.document_shares (document_id);
create index if not exists idx_document_shares_user on public.document_shares (shared_with_user_id);

alter table public.document_shares enable row level security;

create policy "Document owner manages shares"
  on public.document_shares for all
  using (exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid()));

create policy "Shared user sees their own share row"
  on public.document_shares for select
  using (shared_with_user_id = auth.uid());

-- Replace the owner-only blanket policy from the previous migration with
-- per-operation policies so shared users can read (all permission levels)
-- or write (editor only) documents shared with them, while creation and
-- deletion stay owner-only.
drop policy if exists "Users manage their own documents" on public.documents;

create policy "Owner or shared user can view a document"
  on public.documents for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.document_shares ds
      where ds.document_id = id and ds.shared_with_user_id = auth.uid()
    )
  );

-- 'commenter' is included here (not just 'editor') because comments are
-- stored inline on the document row (see the jsonb `comments` column), so
-- adding a comment is technically a row update. The app's own UI still
-- keeps contentEditable off for commenters/viewers - this is a row-level,
-- not column-level, grant, so a commenter could in principle write to
-- content_html via a raw API call rather than through the app.
create policy "Owner or editor/commenter-shared user can update a document"
  on public.documents for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.document_shares ds
      where ds.document_id = id and ds.shared_with_user_id = auth.uid() and ds.permission in ('editor', 'commenter')
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.document_shares ds
      where ds.document_id = id and ds.shared_with_user_id = auth.uid() and ds.permission in ('editor', 'commenter')
    )
  );

create policy "Only owner can create documents"
  on public.documents for insert
  with check (owner_id = auth.uid());

create policy "Only owner can delete documents"
  on public.documents for delete
  using (owner_id = auth.uid());

-- Look up a user to invite by email, scoped to the caller's own school so
-- this can't be used to enumerate accounts across schools. SECURITY DEFINER
-- is required because profiles RLS doesn't otherwise allow looking up
-- someone else's row by email.
create or replace function public.find_user_by_email_in_school(p_email text)
returns table (id uuid, full_name text, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  where lower(p.email) = lower(p_email)
    and p.school_id = (select school_id from public.profiles where id = auth.uid())
    and p.id != auth.uid();
$$;
