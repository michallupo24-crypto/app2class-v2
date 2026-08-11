-- 2.E1: the 15% MoE absence threshold was only ever computed client-side
-- (src/utils/gradingEngine.ts), on demand, when someone happened to open a
-- grade report. No proactive alert existed. This trigger recomputes the
-- per-subject absence percentage on every new absence and notifies the
-- student's homeroom educator the moment they cross 15% for that subject
-- (fires once per crossing, not on every subsequent absence).

create or replace function public.check_absence_red_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_class_id uuid;
  v_school_id uuid;
  v_educator_id uuid;
  v_total_lessons int;
  v_total_absent int;
  v_pct_before numeric;
  v_pct_after numeric;
  v_student_name text;
begin
  if NEW.status <> 'absent' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.status = 'absent' then
    return NEW;
  end if;

  select l.subject, l.class_id, l.school_id into v_subject, v_class_id, v_school_id
  from public.lessons l where l.id = NEW.lesson_id;

  if v_class_id is null then
    return NEW;
  end if;

  select count(*) into v_total_lessons
  from public.lessons l where l.class_id = v_class_id and l.subject = v_subject;

  if v_total_lessons = 0 then
    return NEW;
  end if;

  select count(*) into v_total_absent
  from public.attendance a
  join public.lessons l on l.id = a.lesson_id
  where a.student_id = NEW.student_id and l.class_id = v_class_id and l.subject = v_subject and a.status = 'absent';

  v_pct_after := (v_total_absent::numeric / v_total_lessons) * 100;
  v_pct_before := ((v_total_absent - 1)::numeric / v_total_lessons) * 100;

  if v_pct_before <= 15 and v_pct_after > 15 then
    select ur.user_id into v_educator_id
    from public.user_roles ur
    where ur.role = 'educator'::app_role and ur.homeroom_class_id = v_class_id
    limit 1;

    if v_educator_id is not null then
      select full_name into v_student_name from public.profiles where id = NEW.student_id;
      perform public.create_notification(
        v_educator_id, 'attendance_red_line',
        'קו אדום נוכחות: ' || coalesce(v_student_name, 'תלמיד/ה'),
        coalesce(v_student_name, 'התלמיד/ה') || ' חצה/תה 15% היעדרויות ב' || coalesce(v_subject, 'מקצוע') || ' (' || round(v_pct_after) || '%)',
        '/dashboard/roll-call',
        v_school_id
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_absence_red_line on public.attendance;
create trigger trg_check_absence_red_line
  after insert or update of status on public.attendance
  for each row execute function public.check_absence_red_line();
