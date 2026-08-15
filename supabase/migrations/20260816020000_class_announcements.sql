-- ClassMessenger.tsx ("לוח הודעות כיתתי") has been completely non-functional
-- since it was written, for every teacher, on every class - it repurposes the
-- public.factions/faction_posts tables (built for the separate school-wide
-- "App2Community" forums feature) with THREE compounding failures:
--   1. factions.faction_type has a CHECK constraint allowing only
--      ('main_hub', 'student_sanctuary', 'staff_room', 'parents_circle') -
--      "class_board" is not one of them, so the insert always violates the
--      constraint and fails.
--   2. Even with a valid type, "Admin can manage factions" only grants INSERT
--      to management/system_admin - a regular teacher can never create one.
--   3. faction_posts INSERT requires an existing faction_members row for the
--      poster, which ClassMessenger never creates.
-- All three failures are silent in the component (no `error` check on the
-- faction insert, no `else` branch when postMessage's faction lookup comes
-- back null), so a teacher just sees "no messages yet" forever and sending
-- silently does nothing.
--
-- Rather than retrofit factions' broader multi-membership forum semantics to
-- fit a much simpler need (everyone in one class can read, only that class's
-- teachers can write), this gives class announcements their own table.

create table public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null,
  is_pinned boolean not null default false,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_class_announcements_class on public.class_announcements(class_id);

alter table public.class_announcements enable row level security;

create policy "Class members can view announcements" on public.class_announcements
  for select to authenticated
  using (
    not is_removed and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.class_id = class_announcements.class_id)
      or exists (select 1 from public.teacher_classes tc where tc.user_id = auth.uid() and tc.class_id = class_announcements.class_id)
      or exists (
        select 1 from public.parent_student ps
        join public.profiles st on st.id = ps.student_id
        where ps.parent_id = auth.uid() and st.class_id = class_announcements.class_id
      )
      or has_role(auth.uid(), 'management'::app_role)
      or has_role(auth.uid(), 'system_admin'::app_role)
    )
  );

create policy "Class teachers can post announcements" on public.class_announcements
  for insert to authenticated
  with check (
    author_id = auth.uid() and (
      exists (select 1 from public.teacher_classes tc where tc.user_id = auth.uid() and tc.class_id = class_announcements.class_id)
      or has_role(auth.uid(), 'management'::app_role)
      or has_role(auth.uid(), 'system_admin'::app_role)
    )
  );

create policy "Class teachers can update announcements" on public.class_announcements
  for update to authenticated
  using (
    exists (select 1 from public.teacher_classes tc where tc.user_id = auth.uid() and tc.class_id = class_announcements.class_id)
    or has_role(auth.uid(), 'management'::app_role)
    or has_role(auth.uid(), 'system_admin'::app_role)
  );

create trigger update_class_announcements_updated_at
  before update on public.class_announcements
  for each row execute function public.update_updated_at_column();
