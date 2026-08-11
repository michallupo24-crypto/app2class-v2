-- 2.P5 (logistics reminders): grade_announcements already had a 'logistics'
-- type and a 'parents' target_audience option (GradeAnnouncementsPage.tsx),
-- and event_approvals/EventApprovalsPage.tsx already implements real digital
-- consent forms for trips — both were more complete than assumed. The actual
-- gap: publishing an announcement never notified anyone, it just sat in a
-- list parents had to remember to check. Same class of fix as the emergency
-- announcement trigger in 0.4.

create or replace function public.notify_grade_announcement_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.published = true)
     or (TG_OP = 'UPDATE' and NEW.published = true and OLD.published is distinct from NEW.published) then

    if NEW.target_audience in ('all', 'students') then
      insert into public.notifications (user_id, school_id, type, title, body, link)
      select p.id, NEW.school_id, 'grade_announcement', NEW.title, NEW.content, '/dashboard'
      from public.profiles p
      join public.classes c on c.id = p.class_id
      where c.school_id = NEW.school_id and c.grade = NEW.grade;
    end if;

    if NEW.target_audience in ('all', 'parents') then
      insert into public.notifications (user_id, school_id, type, title, body, link)
      select distinct ps.parent_id, NEW.school_id, 'grade_announcement', NEW.title, NEW.content, '/dashboard'
      from public.parent_student ps
      join public.profiles p on p.id = ps.student_id
      join public.classes c on c.id = p.class_id
      where c.school_id = NEW.school_id and c.grade = NEW.grade;
    end if;

    if NEW.target_audience in ('all', 'homeroom_teachers', 'teachers') then
      insert into public.notifications (user_id, school_id, type, title, body, link)
      select ur.user_id, NEW.school_id, 'grade_announcement', NEW.title, NEW.content, '/dashboard'
      from public.user_roles ur
      join public.classes c on c.id = ur.homeroom_class_id
      where ur.role = 'educator'::app_role and c.school_id = NEW.school_id and c.grade = NEW.grade;
    end if;

  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_grade_announcement on public.grade_announcements;
create trigger trg_notify_grade_announcement
  after insert or update on public.grade_announcements
  for each row execute function public.notify_grade_announcement_published();
