-- TeacherDashboard's AI tip card claimed a hardcoded, fabricated count of
-- non-submitting students with a "send reminder" button that had no
-- onClick at all. The frontend now computes the real non-submitter list
-- for the class's most recent assignment; this RPC lets the teacher
-- actually send the reminder as a real notification, following the same
-- SECURITY DEFINER + create_notification() pattern as book_meeting_slot
-- (0.4 / 2.P4/P5) since create_notification's execute grant is revoked
-- from authenticated and can only be called from a definer function that
-- authorizes the caller first.

create or replace function public.send_submission_reminders(p_assignment_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_school_id uuid;
  v_title text;
  v_teacher_id uuid;
  v_count int := 0;
  v_student record;
  v_parent_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select class_id, school_id, title, teacher_id into v_class_id, v_school_id, v_title, v_teacher_id
  from public.assignments where id = p_assignment_id;

  if v_class_id is null then
    raise exception 'Assignment not found';
  end if;

  if v_teacher_id <> auth.uid() and not exists (
    select 1 from public.teacher_classes tc
    where tc.user_id = auth.uid() and tc.class_id = v_class_id
  ) then
    raise exception 'Not authorized: not your class';
  end if;

  for v_student in
    select p.id, p.full_name from public.profiles p
    where p.class_id = v_class_id
      and not exists (
        select 1 from public.submissions s
        where s.assignment_id = p_assignment_id
          and s.student_id = p.id
          and s.status in ('submitted', 'graded', 'revised')
      )
  loop
    perform public.create_notification(
      v_student.id, 'submission_reminder',
      'תזכורת: הגשת מטלה',
      'טרם הגשת את "' || v_title || '". אנא הגש/י בהקדם.',
      '/dashboard/tasks',
      v_school_id
    );

    for v_parent_id in
      select ps.parent_id from public.parent_student ps where ps.student_id = v_student.id
    loop
      perform public.create_notification(
        v_parent_id, 'submission_reminder',
        'תזכורת הגשה: ' || coalesce(v_student.full_name, 'התלמיד/ה'),
        coalesce(v_student.full_name, 'התלמיד/ה') || ' טרם הגיש/ה את "' || v_title || '".',
        '/dashboard/my-child',
        v_school_id
      );
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.send_submission_reminders(uuid) from public, anon;
grant execute on function public.send_submission_reminders(uuid) to authenticated;
