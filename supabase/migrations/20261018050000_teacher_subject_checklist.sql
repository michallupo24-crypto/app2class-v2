-- A teacher's personal checklist per class x subject ("המקצועות שלי" folder).
create table if not exists public.teacher_subject_checklist (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text not null,
  text text not null check (length(btrim(text)) between 1 and 300),
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists teacher_subject_checklist_owner_idx
  on public.teacher_subject_checklist (teacher_id, class_id, subject);

alter table public.teacher_subject_checklist enable row level security;

drop policy if exists "Teachers manage own subject checklist" on public.teacher_subject_checklist;
create policy "Teachers manage own subject checklist" on public.teacher_subject_checklist
for all to authenticated
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.current_user_school_id())
);
