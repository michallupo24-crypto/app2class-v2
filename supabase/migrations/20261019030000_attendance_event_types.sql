-- Per-school list of quick events in the roll call "⋯" menu (איחור, הפרעה,
-- ציון לשבח, שימוש בטלפון ...). Management can add / rename / remove / reorder.
--
-- kind:
--   'late'     - marks the attendance status as late (attendance.status)
--   'negative' - a discipline note (lesson_notes)
--   'positive' - a positive note (lesson_notes)
-- category: which note_category a note is stored under. The seeded defaults use
-- the existing categories so reports keep working; events a school adds itself
-- are stored as custom_negative / custom_positive with the event's label in
-- lesson_notes.note and a link in lesson_notes.event_type_id.

alter type public.note_category add value if not exists 'custom_negative';
alter type public.note_category add value if not exists 'custom_positive';

create table if not exists public.attendance_event_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 40),
  kind text not null check (kind in ('late', 'negative', 'positive')),
  category public.note_category,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'late') = (category is null))
);

create index if not exists attendance_event_types_school_idx
  on public.attendance_event_types (school_id, sort_order);

alter table public.attendance_event_types enable row level security;

drop policy if exists "School members read attendance event types" on public.attendance_event_types;
create policy "School members read attendance event types" on public.attendance_event_types
for select to authenticated
using (school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Managers edit attendance event types" on public.attendance_event_types;
create policy "Managers edit attendance event types" on public.attendance_event_types
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

alter table public.lesson_notes
  add column if not exists event_type_id uuid references public.attendance_event_types (id) on delete set null;

-- Defaults, for existing schools and every new one.
create or replace function public.seed_attendance_event_types(p_school_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.attendance_event_types (school_id, label, kind, category, sort_order)
  select p_school_id, d.label, d.kind, d.category::public.note_category, d.sort_order
  from (values
    ('איחור', 'late', null, 0),
    ('הפרעה', 'negative', 'disruption', 1),
    ('ציון לשבח', 'positive', 'positive_participation', 2),
    ('שימוש בטלפון', 'negative', 'phone', 3)
  ) as d(label, kind, category, sort_order)
  where not exists (select 1 from public.attendance_event_types t where t.school_id = p_school_id);
$$;

revoke execute on function public.seed_attendance_event_types(uuid) from public, anon, authenticated;

create or replace function public.seed_attendance_event_types_for_new_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_attendance_event_types(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_attendance_event_types on public.schools;
create trigger trg_seed_attendance_event_types
after insert on public.schools
for each row execute function public.seed_attendance_event_types_for_new_school();

select public.seed_attendance_event_types(id) from public.schools;
