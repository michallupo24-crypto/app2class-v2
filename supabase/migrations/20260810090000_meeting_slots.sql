-- 2.P4: parent-teacher meeting scheduling did not exist at all. Educators
-- publish open time slots; parents book one for their child through a
-- SECURITY DEFINER RPC (not a raw UPDATE) so a parent can never tamper with
-- slot fields beyond claiming an open one for a child that is actually theirs.

create table public.meeting_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  school_id uuid not null references public.schools(id),
  class_id uuid references public.classes(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false,
  booked_by_parent_id uuid,
  student_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_meeting_slots_teacher on public.meeting_slots(teacher_id);
create index idx_meeting_slots_class on public.meeting_slots(class_id);

alter table public.meeting_slots enable row level security;

create policy "Authenticated can view meeting slots" on public.meeting_slots
  for select to authenticated using (true);

create policy "Teachers manage own slots" on public.meeting_slots
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create or replace function public.book_meeting_slot(p_slot_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.parent_student ps
    where ps.parent_id = auth.uid() and ps.student_id = p_student_id
  ) then
    raise exception 'Not authorized: not your child';
  end if;

  update public.meeting_slots
  set is_booked = true, booked_by_parent_id = auth.uid(), student_id = p_student_id
  where id = p_slot_id and is_booked = false
  returning teacher_id into v_teacher_id;

  if v_teacher_id is null then
    raise exception 'Slot no longer available';
  end if;

  perform public.create_notification(v_teacher_id, 'meeting_booked', 'הורה קבע פגישה', null, '/dashboard/meetings');
end;
$$;

create or replace function public.cancel_meeting_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_parent_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select teacher_id, booked_by_parent_id into v_teacher_id, v_parent_id
  from public.meeting_slots where id = p_slot_id;

  if v_teacher_id is null or (v_teacher_id <> auth.uid() and (v_parent_id is null or v_parent_id <> auth.uid())) then
    raise exception 'Not authorized';
  end if;

  update public.meeting_slots
  set is_booked = false, booked_by_parent_id = null, student_id = null
  where id = p_slot_id;

  if v_parent_id is not null and v_parent_id <> auth.uid() then
    perform public.create_notification(v_parent_id, 'meeting_cancelled', 'הפגישה בוטלה על ידי המורה', null, '/dashboard/meetings');
  elsif v_teacher_id <> auth.uid() then
    perform public.create_notification(v_teacher_id, 'meeting_cancelled', 'ההורה ביטל את הפגישה', null, '/dashboard/meetings');
  end if;
end;
$$;

revoke execute on function public.book_meeting_slot(uuid, uuid) from public, anon;
grant execute on function public.book_meeting_slot(uuid, uuid) to authenticated;
revoke execute on function public.cancel_meeting_slot(uuid) from public, anon;
grant execute on function public.cancel_meeting_slot(uuid) to authenticated;

alter publication supabase_realtime add table public.meeting_slots;
