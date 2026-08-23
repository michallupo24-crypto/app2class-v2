-- Fixes "infinite recursion detected in policy for relation document_shares",
-- hit live when sharing a document. Root cause: documents' SELECT/UPDATE
-- policies check document_shares via an inline EXISTS subquery, and
-- document_shares' own policy checks documents via an inline EXISTS
-- subquery - each subquery re-triggers RLS evaluation on the other table,
-- which re-triggers the first, forever. Standard fix (already used
-- elsewhere in this project - see can_approve()/has_role()): move the
-- cross-table checks into SECURITY DEFINER helper functions, which bypass
-- RLS on their internal queries and so don't re-enter either policy.

create or replace function public.is_document_owner(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.documents where id = p_document_id and owner_id = auth.uid()
  );
$$;

revoke execute on function public.is_document_owner(uuid) from public, anon;
grant execute on function public.is_document_owner(uuid) to authenticated;

create or replace function public.document_share_permission(p_document_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select permission from public.document_shares
  where document_id = p_document_id and shared_with_user_id = auth.uid()
  limit 1;
$$;

revoke execute on function public.document_share_permission(uuid) from public, anon;
grant execute on function public.document_share_permission(uuid) to authenticated;

-- Rebuild documents' policies using the helper functions instead of
-- inline subqueries into document_shares.
drop policy if exists "Owner or shared user can view a document" on public.documents;
drop policy if exists "Owner or editor/commenter-shared user can update a document" on public.documents;
drop policy if exists "Only owner can create documents" on public.documents;
drop policy if exists "Only owner can delete documents" on public.documents;

create policy "Owner or shared user can view a document"
  on public.documents for select
  using (owner_id = auth.uid() or public.document_share_permission(id) is not null);

create policy "Owner or editor/commenter-shared user can update a document"
  on public.documents for update
  using (owner_id = auth.uid() or public.document_share_permission(id) in ('editor', 'commenter'))
  with check (owner_id = auth.uid() or public.document_share_permission(id) in ('editor', 'commenter'));

create policy "Only owner can create documents"
  on public.documents for insert
  with check (owner_id = auth.uid());

create policy "Only owner can delete documents"
  on public.documents for delete
  using (owner_id = auth.uid());

-- Rebuild document_shares' owner policy using the helper function instead
-- of an inline subquery into documents.
drop policy if exists "Document owner manages shares" on public.document_shares;

create policy "Document owner manages shares"
  on public.document_shares for all
  using (public.is_document_owner(document_id))
  with check (public.is_document_owner(document_id));
