-- The timetable builder previously had no history at all: "פרסם מערכת"
-- (handlePublish in TimetableBuilderPage.tsx) deletes every existing
-- timetable_slots row for the affected classes and bulk-inserts the new
-- ones, with nothing kept of what came before. This table lets a
-- coordinator save named snapshots of the in-progress `slots` array (and the
-- publish flow auto-snapshots too), giving a real version history to browse,
-- restore, share, or export - a normal table rather than a jsonb column on
-- some other row (unlike documents.history) since a timetable has no single
-- natural "owner" row to hang it off of, and versions need their own
-- independent RLS/query pattern (list by school, not by document id).
create table public.timetable_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  description text,
  slots jsonb not null,
  is_published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_timetable_versions_school on public.timetable_versions (school_id, created_at desc);

alter table public.timetable_versions enable row level security;

create policy "Same-school staff can view timetable versions" on public.timetable_versions
for select to authenticated
using (school_id = public.current_user_school_id() or has_role(auth.uid(), 'system_admin'));

create policy "Coordinators can manage own-school timetable versions" on public.timetable_versions
for all to authenticated
using (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(), 'system_admin')
  or ((has_role(auth.uid(), 'grade_coordinator') or has_role(auth.uid(), 'management'))
      and school_id = public.current_user_school_id())
);

-- Class-scoped, view-only sharing - deliberately copying presentation_shares
-- (20260826030000_presentation_class_sharing.sql) rather than documents'
-- per-user document_shares: self-contained policies that never reference
-- timetable_versions back, so this can't reintroduce the circular-RLS bug
-- document_shares hit (fixed in 20260823120000).
create table public.timetable_version_shares (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.timetable_versions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (version_id, class_id)
);

create index idx_timetable_version_shares_version on public.timetable_version_shares (version_id);
create index idx_timetable_version_shares_class on public.timetable_version_shares (class_id);

alter table public.timetable_version_shares enable row level security;

create policy "Sharer or classmate can view a timetable share row"
  on public.timetable_version_shares for select
  using (
    shared_by = auth.uid()
    or class_id = (select class_id from public.profiles where id = auth.uid())
  );

create policy "Only same-school coordinators can create a timetable share"
  on public.timetable_version_shares for insert
  with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.timetable_versions v
      where v.id = version_id
        and v.school_id = public.current_user_school_id()
    )
  );

create policy "Only the sharer can delete a timetable share"
  on public.timetable_version_shares for delete
  using (shared_by = auth.uid());

-- Purely additive alongside the coordinators-only policy above - Postgres
-- ORs permissive SELECT policies together, so a class-shared student/parent
-- can view just the versions shared with their own class.
create policy "Class-shared student can view a timetable version"
  on public.timetable_versions for select
  using (
    exists (
      select 1 from public.timetable_version_shares vs
      where vs.version_id = timetable_versions.id
        and vs.class_id = (select class_id from public.profiles where id = auth.uid())
    )
  );
