-- Student council feature, phase 2: candidacy submission now goes through the
-- student's homeroom teacher for review before it's visible/votable, with the
-- council advisor able to override any decision. Today council_candidates has
-- no status/reviewer concept at all - self-nomination is instantly visible to
-- the whole school and instantly votable.

-- 1. Review state on candidates.
alter table public.council_candidates
  add column status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'needs_revision')),
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz,
  add column review_notes text;

-- 2. Helper - same pattern as phase 1's has_active_council_role: security
--    definer/stable so it can be used from RLS policies without recursion.
create or replace function public.is_homeroom_teacher_of(_teacher_id uuid, _student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles st
    join public.user_roles ur on ur.user_id = _teacher_id and ur.role = 'educator' and ur.homeroom_class_id = st.class_id
    where st.id = _student_id
  )
$$;

-- 3. SELECT: approved candidates stay visible school-wide (as before); pending/
--    rejected/needs-revision rows are only visible to the candidate themself,
--    their homeroom teacher, the council advisor, or management.
drop policy if exists "Users can view own-school candidates" on public.council_candidates;

create policy "Own-school can view approved candidates" on public.council_candidates
for select to authenticated
using (
  status = 'approved'
  and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id())
);

create policy "Candidate and reviewers can view own candidacy" on public.council_candidates
for select to authenticated
using (
  student_id = auth.uid()
  or public.is_homeroom_teacher_of(auth.uid(), student_id)
  or has_role(auth.uid(), 'system_admin')
  or (has_role(auth.uid(), 'council_advisor') and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()))
  or (has_role(auth.uid(), 'management') and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()))
);

-- 4. UPDATE: homeroom teacher can decide on their own class's pending
--    candidacies; the student can revise and resubmit one sent back to them.
create policy "Homeroom teacher can review own-class candidacies" on public.council_candidates
for update to authenticated
using (
  public.is_homeroom_teacher_of(auth.uid(), student_id)
  and status = 'pending_review'
)
with check (
  public.is_homeroom_teacher_of(auth.uid(), student_id)
  and status in ('approved', 'rejected', 'needs_revision')
  and reviewed_by = auth.uid()
);

create policy "Students can revise own candidacy needing revision" on public.council_candidates
for update to authenticated
using (student_id = auth.uid() and status = 'needs_revision')
with check (student_id = auth.uid() and status = 'pending_review');

-- 5. Council advisor gets the same override power management already has
--    (approve/reject/revise/delete any candidacy in their school, at any stage).
drop policy if exists "Management can manage own-school candidates" on public.council_candidates;
create policy "Management can manage own-school candidates" on public.council_candidates
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()))
  or (has_role(auth.uid(),'council_advisor') and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = election_id and e.school_id = public.current_user_school_id()))
  or (has_role(auth.uid(),'council_advisor') and exists (select 1 from public.council_elections e where e.id = election_id and e.school_id = public.current_user_school_id()))
);

-- 6. A vote can never land on an unapproved candidate, even from a buggy client.
drop policy if exists "Students can vote once while voting is open" on public.council_votes;
create policy "Students can vote once while voting is open" on public.council_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and exists (select 1 from public.council_elections e where e.id = election_id and e.status = 'voting' and e.school_id = public.current_user_school_id())
  and exists (select 1 from public.council_candidates c where c.id = candidate_id and c.status = 'approved')
);

-- 7. Notifications, reusing the existing create_notification() engine
--    (20260810040000_notifications_engine.sql) instead of a new mechanism.
create or replace function public.notify_new_candidacy_for_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher record;
  v_candidate_name text;
  v_school_id uuid;
begin
  select full_name, school_id into v_candidate_name, v_school_id from public.profiles where id = new.student_id;

  for v_teacher in
    select ur.user_id
    from public.profiles st
    join public.user_roles ur on ur.role = 'educator' and ur.homeroom_class_id = st.class_id
    where st.id = new.student_id
  loop
    perform public.create_notification(
      v_teacher.user_id,
      'council_candidacy_review',
      'מועמדות חדשה למועצה ממתינה לאישורך',
      coalesce(v_candidate_name, 'תלמיד/ה') || ' הגיש/ה מועמדות למועצת התלמידים',
      '/dashboard/council',
      v_school_id
    );
  end loop;
  return new;
end;
$$;

create trigger trg_notify_new_candidacy_for_review
  after insert on public.council_candidates
  for each row execute function public.notify_new_candidacy_for_review();

create or replace function public.notify_candidacy_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_title text;
begin
  if new.status = old.status then
    return new;
  end if;

  select school_id into v_school_id from public.profiles where id = new.student_id;

  v_title := case new.status
    when 'approved' then '✅ המועמדות שלך למועצה אושרה'
    when 'rejected' then 'המועמדות שלך למועצה נדחתה'
    when 'needs_revision' then 'המועמדות שלך למועצה הוחזרה לעריכה'
    else null
  end;

  if v_title is not null then
    perform public.create_notification(
      new.student_id,
      'council_candidacy_reviewed',
      v_title,
      new.review_notes,
      '/dashboard/council',
      v_school_id
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_candidacy_reviewed
  after update of status on public.council_candidates
  for each row execute function public.notify_candidacy_reviewed();
