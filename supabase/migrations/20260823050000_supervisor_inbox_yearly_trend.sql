-- Adds three principal-dashboard features requested for the "מנהלת" (management)
-- role: a Ministry-of-Education supervisor correspondence inbox, and a
-- school-scoped SECURITY DEFINER RPC for multi-year grade trend (mirrors the
-- get_school_grade_averages pattern from 20260815010000 - aggregate in SQL so
-- a school with many years of graded submissions never gets client-side-limit
-- truncation). Bottleneck detection and the PDF export are computed/rendered
-- entirely client-side from data already fetched, so no schema is needed for
-- those two.

-- 1. Supervisor inquiries inbox (תיבת פניות מפקחת)
create table public.supervisor_inquiries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject text not null,
  content text not null,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'answered', 'closed')),
  response text,
  responded_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supervisor_inquiries enable row level security;

create policy "Management can view own-school supervisor inquiries"
on public.supervisor_inquiries for select to authenticated
using (
  has_role(auth.uid(), 'system_admin'::app_role)
  or (
    has_role(auth.uid(), 'management'::app_role)
    and school_id = public.current_user_school_id()
  )
);

create policy "Management can log own-school supervisor inquiries"
on public.supervisor_inquiries for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    has_role(auth.uid(), 'system_admin'::app_role)
    or (
      has_role(auth.uid(), 'management'::app_role)
      and school_id = public.current_user_school_id()
    )
  )
);

create policy "Management can update own-school supervisor inquiries"
on public.supervisor_inquiries for update to authenticated
using (
  has_role(auth.uid(), 'system_admin'::app_role)
  or (
    has_role(auth.uid(), 'management'::app_role)
    and school_id = public.current_user_school_id()
  )
);

create trigger update_supervisor_inquiries_updated_at
before update on public.supervisor_inquiries
for each row execute function public.update_updated_at_column();

create index idx_supervisor_inquiries_school_status on public.supervisor_inquiries(school_id, status);

-- 2. Multi-year grade trend (חיזוי מגמות רב-שנתי), aggregated server-side.
-- Buckets by Israeli school year (Sept-Aug), i.e. a submission graded in
-- Jan-Aug of year Y is attributed to the school year that started Sept of
-- year Y-1.
create or replace function public.get_school_yearly_grade_trend(p_school_id uuid)
returns table(school_year int, avg_grade int, submission_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if not (
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'system_admin'::app_role)
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = p_school_id)
     and not has_role(auth.uid(), 'system_admin'::app_role) then
    raise exception 'Not authorized';
  end if;

  return query
  with per_submission as (
    select
      (extract(year from s.graded_at)::int
        - (case when extract(month from s.graded_at) < 9 then 1 else 0 end)) as syear,
      round((s.grade::numeric / coalesce(a.max_grade, 100)) * 100) as normalized_grade
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classes c on c.id = a.class_id
    where c.school_id = p_school_id
      and s.status = 'graded'
      and s.grade is not null
      and s.graded_at is not null
  )
  select
    per_submission.syear as school_year,
    round(avg(per_submission.normalized_grade))::int as avg_grade,
    count(*)::int as submission_count
  from per_submission
  group by per_submission.syear
  order by per_submission.syear;
end;
$$;

revoke execute on function public.get_school_yearly_grade_trend(uuid) from public, anon;
grant execute on function public.get_school_yearly_grade_trend(uuid) to authenticated;
