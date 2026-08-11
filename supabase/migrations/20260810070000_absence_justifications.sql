-- 2.S4: Absence justification used to flip attendance.status straight to
-- 'excused' the moment a student submitted free text — no educator ever
-- reviewed it, and the reason had no fixed categories. This adds a real
-- pending-review table: submitting only creates a request; attendance only
-- changes once the student's homeroom educator (or school management)
-- approves it via public.can_approve, the same school/class scoping built
-- for 0.3.

create table public.absence_justifications (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  student_id uuid not null,
  reason text not null check (reason in ('illness', 'medical_appointment', 'family_event', 'religious_observance', 'transportation', 'other')),
  details text,
  attachment_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_absence_justifications_student on public.absence_justifications(student_id);
create index idx_absence_justifications_attendance on public.absence_justifications(attendance_id);

alter table public.absence_justifications enable row level security;

create policy "Students manage own justification requests" on public.absence_justifications
  for select to authenticated using (student_id = auth.uid());

create policy "Students can submit justification requests" on public.absence_justifications
  for insert to authenticated with check (student_id = auth.uid());

create policy "Educators can view justifications for their students" on public.absence_justifications
  for select to authenticated using (public.can_approve(auth.uid(), 'educator'::app_role, student_id));

create policy "Educators can review justifications for their students" on public.absence_justifications
  for update to authenticated
  using (public.can_approve(auth.uid(), 'educator'::app_role, student_id) and status = 'pending')
  with check (public.can_approve(auth.uid(), 'educator'::app_role, student_id));

create or replace function public.apply_absence_justification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status and NEW.status = 'approved' then
    update public.attendance set status = 'excused' where id = NEW.attendance_id;
  end if;

  if NEW.status is distinct from OLD.status and NEW.status in ('approved', 'rejected') then
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
    perform public.create_notification(
      NEW.student_id,
      'absence_justification_decided',
      case when NEW.status = 'approved' then 'ההצדקה שלך אושרה' else 'ההצדקה שלך נדחתה' end,
      null,
      '/dashboard/attendance'
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_absence_justification_decision on public.absence_justifications;
create trigger trg_absence_justification_decision
  before update on public.absence_justifications
  for each row execute function public.apply_absence_justification_decision();
