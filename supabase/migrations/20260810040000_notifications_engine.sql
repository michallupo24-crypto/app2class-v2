-- 0.4: Real proactive notifications engine. Previously the app only had two
-- hardcoded badges (unread chat count, pending approvals count) computed
-- live on load — nothing pushed proactively and nothing else in the spec's
-- many "don't forget" / deadline / schedule-change alerts existed at all.
-- This adds a real notifications table plus triggers off real events
-- (approval decisions, approved exams/assignments, emergency announcements)
-- so rows actually get created when those events happen, and a realtime
-- feed the frontend can subscribe to.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can mark own notifications read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.notifications;

create or replace function public.create_notification(
  p_user_id uuid, p_type text, p_title text, p_body text default null, p_link text default null, p_school_id uuid default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, school_id, type, title, body, link)
  values (p_user_id, p_school_id, p_type, p_title, p_body, p_link);
$$;

revoke execute on function public.create_notification(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- Approval decided -> notify the requester
create or replace function public.notify_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status and NEW.status in ('approved', 'rejected') then
    perform public.create_notification(
      NEW.user_id,
      'approval_decided',
      case when NEW.status = 'approved' then 'הבקשה שלך אושרה' else 'הבקשה שלך נדחתה' end,
      NEW.notes,
      '/dashboard'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_approval_decided on public.approvals;
create trigger trg_notify_approval_decided
  after update on public.approvals
  for each row execute function public.notify_approval_decided();

-- Exam/assignment approved for a grade -> notify every student in that grade
create or replace function public.notify_grade_event_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if NEW.status is distinct from OLD.status and NEW.status = 'approved' then
    v_label := case NEW.event_type when 'exam' then 'מבחן' when 'assignment' then 'מטלה' else 'אירוע' end;
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, NEW.school_id, 'grade_event_approved',
      v_label || ' חדש/ה אושר/ה: ' || NEW.title,
      to_char(NEW.event_date, 'DD/MM/YYYY') || case when NEW.subject is not null then ' • ' || NEW.subject else '' end,
      '/dashboard/calendar'
    from public.profiles p
    join public.classes c on c.id = p.class_id
    where c.school_id = NEW.school_id and c.grade = NEW.grade;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_grade_event_approved on public.grade_events;
create trigger trg_notify_grade_event_approved
  after update on public.grade_events
  for each row execute function public.notify_grade_event_approved();

-- Emergency announcement -> notify everyone in scope immediately
create or replace function public.notify_emergency_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.severity = 'emergency' then
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, NEW.school_id, 'emergency_announcement', NEW.title, NEW.content, '/dashboard'
    from public.profiles p
    where NEW.school_id is null or p.school_id = NEW.school_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_emergency_announcement on public.system_announcements;
create trigger trg_notify_emergency_announcement
  after insert on public.system_announcements
  for each row execute function public.notify_emergency_announcement();
