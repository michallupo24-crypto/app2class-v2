-- Subject coordinators asked for a proactive reminder about upcoming exams
-- ("מבחן", not "בוחן") that still have no study material attached, one week
-- out. There's no scheduled job (pg_cron) anywhere in this project yet, so
-- rather than introduce that as an unverified new piece of infra, this is
-- called client-side whenever a subject coordinator's dashboard loads
-- (TeacherDashboard.tsx) - same "check on view + push a real notification,
-- deduplicated by link" pattern as send_submission_reminders (0.4).
--
-- "Material" is approximated as assignments.description being non-empty,
-- since there is no dedicated materials/file table - the closest real field
-- available on the assignments row.

create or replace function public.check_missing_exam_material()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_school_id uuid;
  v_count int := 0;
  v_a record;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select ur.subject, p.school_id into v_subject, v_school_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and ur.role = 'subject_coordinator'
  limit 1;

  if v_subject is null then
    raise exception 'Not a subject coordinator';
  end if;

  for v_a in
    select id, title from public.assignments
    where school_id = v_school_id
      and subject = v_subject
      and title ilike '%מבחן%'
      and title not ilike '%בוחן%'
      and published = true
      and due_date is not null
      and due_date > now()
      and due_date <= now() + interval '7 days'
      and (description is null or length(trim(description)) = 0)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = auth.uid()
          and n.type = 'missing_exam_material'
          and n.link = '/dashboard/schedule?assignment=' || id::text
      )
  loop
    perform public.create_notification(
      auth.uid(), 'missing_exam_material',
      'תזכורת: חומר למבחן חסר',
      'המבחן "' || v_a.title || '" מתקיים בעוד פחות משבוע וטרם הועלה עבורו חומר לימוד.',
      '/dashboard/schedule?assignment=' || v_a.id::text,
      v_school_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.check_missing_exam_material() from public, anon;
grant execute on function public.check_missing_exam_material() to authenticated;
