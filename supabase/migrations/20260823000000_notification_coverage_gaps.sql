-- The notifications engine (0.4, 2.P5 etc.) already covers approvals, grade
-- events, emergency announcements, meeting bookings, absence justifications,
-- red-line attendance and submission reminders — but several other
-- significant, proactively-expected events still never touch
-- public.notifications at all, so users only learn about them by happening
-- to open the right page:
--   * a new chat message while the recipient isn't on ChatPage
--   * a teacher publishing a new assignment
--   * a submission getting graded (student AND parent both care)
--   * a teacher starting a live lesson
--   * a class announcement (class_announcements, the table that replaced
--     the broken factions-based ClassMessenger)
-- This wires all five into the existing create_notification()/notifications
-- pattern, following the same recipient-lookup joins already used by
-- notify_grade_announcement_published and notify_approval_decided.

-- New chat message -> notify every other (non-muted) participant
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_sender_name text;
begin
  select school_id into v_school_id from public.conversations where id = NEW.conversation_id;
  select full_name into v_sender_name from public.profiles where id = NEW.sender_id;

  insert into public.notifications (user_id, school_id, type, title, body, link)
  select cp.user_id, v_school_id, 'new_message', coalesce(v_sender_name, 'הודעה חדשה'),
    left(NEW.content, 200), '/dashboard/chat?conversation=' || NEW.conversation_id::text
  from public.conversation_participants cp
  where cp.conversation_id = NEW.conversation_id
    and cp.user_id <> NEW.sender_id
    and coalesce(cp.muted, false) = false;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- Assignment published -> notify every student in the class
create or replace function public.notify_assignment_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if (TG_OP = 'INSERT' and NEW.published = true)
     or (TG_OP = 'UPDATE' and NEW.published = true and OLD.published is distinct from NEW.published) then
    v_label := case NEW.type
      when 'exam' then 'מבחן' when 'quiz' then 'בוחן' when 'project' then 'פרויקט'
      when 'exercise' then 'תרגיל' else 'שיעורי בית' end;
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, NEW.school_id, 'assignment_published',
      v_label || ' חדש/ה: ' || NEW.title,
      case when NEW.due_date is not null then 'להגשה עד ' || to_char(NEW.due_date, 'DD/MM/YYYY') else NEW.subject end,
      '/dashboard/tasks'
    from public.profiles p
    where p.class_id = NEW.class_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_assignment_published on public.assignments;
create trigger trg_notify_assignment_published
  after insert or update on public.assignments
  for each row execute function public.notify_assignment_published();

-- Submission graded -> notify the student and their parents
create or replace function public.notify_submission_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_school_id uuid;
  v_max_grade smallint;
  v_student_name text;
begin
  if NEW.status = 'graded' and (TG_OP = 'INSERT' or OLD.status is distinct from 'graded') then
    select title, school_id, max_grade into v_title, v_school_id, v_max_grade
    from public.assignments where id = NEW.assignment_id;

    select full_name into v_student_name from public.profiles where id = NEW.student_id;

    insert into public.notifications (user_id, school_id, type, title, body, link)
    values (NEW.student_id, v_school_id, 'submission_graded',
      'הציון שלך התקבל: ' || v_title,
      NEW.grade::text || '/' || coalesce(v_max_grade, 100)::text || case when NEW.feedback is not null then ' • ' || NEW.feedback else '' end,
      '/dashboard/grades');

    insert into public.notifications (user_id, school_id, type, title, body, link)
    select ps.parent_id, v_school_id, 'submission_graded',
      'ציון חדש עבור ' || coalesce(v_student_name, 'הילד/ה') || ': ' || v_title,
      NEW.grade::text || '/' || coalesce(v_max_grade, 100)::text,
      '/dashboard/my-child'
    from public.parent_student ps
    where ps.student_id = NEW.student_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_submission_graded on public.submissions;
create trigger trg_notify_submission_graded
  after insert or update on public.submissions
  for each row execute function public.notify_submission_graded();

-- Live lesson started -> notify every student in the class
create or replace function public.notify_live_session_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' or (OLD.is_active = false and NEW.is_active = true) then
    insert into public.notifications (user_id, school_id, type, title, body, link)
    select p.id, NEW.school_id, 'live_lesson_started',
      'שיעור חי התחיל: ' || NEW.subject, null, '/dashboard/live-student'
    from public.profiles p
    where p.class_id = NEW.class_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_live_session_started on public.live_sessions;
create trigger trg_notify_live_session_started
  after insert or update on public.live_sessions
  for each row execute function public.notify_live_session_started();

-- Class announcement posted -> notify every student in the class (parents
-- have no UI for class_announcements yet, unlike grade_announcements, so
-- they're intentionally not notified here)
create or replace function public.notify_class_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if NEW.is_removed then
    return NEW;
  end if;
  select school_id into v_school_id from public.classes where id = NEW.class_id;

  insert into public.notifications (user_id, school_id, type, title, body, link)
  select p.id, v_school_id, 'class_announcement', 'הודעה חדשה בלוח הכיתה', NEW.content, '/dashboard/student-home'
  from public.profiles p
  where p.class_id = NEW.class_id and p.id <> NEW.author_id;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_class_announcement on public.class_announcements;
create trigger trg_notify_class_announcement
  after insert on public.class_announcements
  for each row execute function public.notify_class_announcement();
