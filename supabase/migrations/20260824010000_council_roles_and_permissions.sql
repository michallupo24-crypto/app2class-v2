-- Student council feature, phase 1: role management and automatic permission
-- grants. Separate migration/transaction from 20260824000000 so the new
-- 'council_advisor' enum value is safe to reference here.

-- 1. user_roles: today only ever self-inserted at registration, with no
--    UPDATE/DELETE policy at all - no existing user can ever have a role
--    granted or revoked by anyone else. Add narrow management-only grant/
--    revoke policies scoped to just the 'council_advisor' role (not a
--    general role editor - deliberately out of scope for this phase).
create policy "Management can grant council_advisor" on public.user_roles
for insert to authenticated
with check (
  role = 'council_advisor'
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);

create policy "Management can revoke council_advisor" on public.user_roles
for delete to authenticated
using (
  role = 'council_advisor'
  and has_role(auth.uid(), 'management')
  and exists (
    select 1 from public.profiles p
    where p.id = user_roles.user_id and p.school_id = public.current_user_school_id()
  )
);

-- 2. council_members: extend to carry structured leadership roles instead of
--    just a free-text "position" label that grants no real permissions.
alter table public.council_members
  add column role_type text not null default 'member' check (role_type in ('member', 'head', 'newspaper_editor')),
  add column appointed_by uuid references auth.users(id),
  add column appointment_type text not null default 'appointed' check (appointment_type in ('appointed', 'elected'));

-- Only one active council head per school at a time.
create unique index council_one_active_head on public.council_members(school_id)
  where role_type = 'head' and is_active;

-- Let the council advisor manage council_members in their own school, same as management.
drop policy if exists "Management can manage own-school council members" on public.council_members;
create policy "Management can manage own-school council members" on public.council_members
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (has_role(auth.uid(),'council_advisor') and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (has_role(auth.uid(),'council_advisor') and school_id = public.current_user_school_id())
);

-- 3. Helper used by every permission grant below - security definer/stable to
--    match this codebase's established pattern for RLS checks that span two
--    tables (see is_document_owner/document_share_permission), avoiding the
--    cross-table RLS recursion class already hit twice in this repo.
create or replace function public.has_active_council_role(_user_id uuid, _role_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.council_members
    where student_id = _user_id and role_type = _role_type and is_active
  )
$$;

-- 4. Council head can broadcast school-wide, same as management today.
drop policy if exists "Management can create school announcements" on public.system_announcements;
create policy "Management can create school announcements" on public.system_announcements
for insert to authenticated
with check (
  (has_role(auth.uid(), 'management') and school_id = (select school_id from public.profiles where id = auth.uid()))
  or has_role(auth.uid(), 'system_admin')
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
);

-- 5. Council head gets the same bell-song-suggestion moderation rights
--    management has today (there's no separate "bell schedule" admin
--    lifecycle in this codebase to hook a narrower permission into).
drop policy if exists "Management can manage own-school song suggestions" on public.bell_song_suggestions;
create policy "Management can manage own-school song suggestions" on public.bell_song_suggestions
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
);

-- 6. Newspaper: council head and newspaper editor both get the same
--    review/publish/reject rights staff has today. The review UPDATE policy
--    is row-level, so this also lets them edit title/content/category on any
--    article in their school, not just change its status.
drop policy if exists "Staff can view own-school articles for review" on public.newspaper_articles;
create policy "Staff can view own-school articles for review" on public.newspaper_articles
for select to authenticated
using (
  (has_role(auth.uid(), 'educator') or has_role(auth.uid(), 'management') or
   has_role(auth.uid(), 'system_admin') or has_role(auth.uid(), 'counselor') or
   public.has_active_council_role(auth.uid(), 'head') or
   public.has_active_council_role(auth.uid(), 'newspaper_editor'))
  and school_id = public.current_user_school_id()
);

drop policy if exists "Staff can review and publish own-school articles" on public.newspaper_articles;
create policy "Staff can review and publish own-school articles" on public.newspaper_articles
for update to authenticated
using (
  (has_role(auth.uid(), 'educator') or has_role(auth.uid(), 'management') or
   has_role(auth.uid(), 'system_admin') or has_role(auth.uid(), 'counselor') or
   public.has_active_council_role(auth.uid(), 'head') or
   public.has_active_council_role(auth.uid(), 'newspaper_editor'))
  and school_id = public.current_user_school_id()
);

-- 7. Council advisor can see live vote counts on any election, not just
--    closed ones (management already could server-side; the client just
--    never asked for it - fixed in CouncilPage.tsx alongside this).
drop policy if exists "Management can view own-school votes" on public.council_votes;
create policy "Management can view own-school votes" on public.council_votes
for select to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = council_votes.election_id and e.school_id = public.current_user_school_id()))
  or (has_role(auth.uid(),'council_advisor') and exists (select 1 from public.council_elections e where e.id = council_votes.election_id and e.school_id = public.current_user_school_id()))
);
