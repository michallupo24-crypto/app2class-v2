-- 2.E7 (Wellness & Counselor Sync): the spec calls out "המחנך יכול לסמן תלמידים כ'דרושים
-- תשומת לב רגשית'. המידע עובר ליועצת בצורה מאובטחת" — and counselor_cases.flagged_reason
-- (20260809120000_counselor_module.sql) already has 'teacher_referral' documented as an
-- expected value, but no teacher-facing path ever wrote one: counselor_cases only allows
-- the owning counselor to insert (counselor_id = auth.uid()). This RPC lets a student's
-- teacher (homeroom educator or any teacher_classes-linked subject teacher) raise a real
-- referral, routed to the counselor(s) actually assigned to that student's grade
-- (user_roles.role='counselor' + grade), same SECURITY DEFINER + create_notification
-- pattern as send_submission_reminders.

create or replace function public.flag_student_for_counselor(p_student_id uuid, p_reason text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_grade public.grade_level;
  v_school_id uuid;
  v_student_name text;
  v_counselor record;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select p.class_id, p.school_id, p.full_name into v_class_id, v_school_id, v_student_name
  from public.profiles p where p.id = p_student_id;

  if v_class_id is null then
    raise exception 'Student not found';
  end if;

  if not exists (
    select 1 from public.teacher_classes tc where tc.user_id = auth.uid() and tc.class_id = v_class_id
  ) and not exists (
    select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'educator'::app_role and ur.homeroom_class_id = v_class_id
  ) then
    raise exception 'Not authorized: not this student''s teacher';
  end if;

  select grade into v_grade from public.classes where id = v_class_id;

  for v_counselor in
    select distinct ur.user_id from public.user_roles ur
    where ur.role = 'counselor'::app_role and ur.grade = v_grade
  loop
    if not exists (
      select 1 from public.counselor_cases cc
      where cc.student_id = p_student_id and cc.counselor_id = v_counselor.user_id and cc.status <> 'closed'
    ) then
      insert into public.counselor_cases (school_id, student_id, counselor_id, status, flagged_reason)
      values (
        v_school_id, p_student_id, v_counselor.user_id, 'new',
        'teacher_referral' || case when p_reason is not null and length(trim(p_reason)) > 0 then ': ' || p_reason else '' end
      );

      perform public.create_notification(
        v_counselor.user_id, 'counselor_referral',
        'הפניה חדשה מהמחנך/ת',
        coalesce(v_student_name, 'תלמיד/ה') || ' סומן/ה כזקוק/ה לתשומת לב רגשית' ||
          case when p_reason is not null and length(trim(p_reason)) > 0 then ': ' || p_reason else '' end,
        '/dashboard/counselor-cases',
        v_school_id
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.flag_student_for_counselor(uuid, text) from public, anon;
grant execute on function public.flag_student_for_counselor(uuid, text) to authenticated;
