-- Student council feature, phase 3: a full class -> grade -> school election
-- tournament run as one "campaign", with automatic advancement of winners
-- between rounds and configurable tie-breaking. Additive to phases 1-2 - the
-- existing flat/simple council_elections flow (no campaign_id) keeps working
-- unchanged; a campaign's class round reuses that exact same
-- nomination/homeroom-review mechanism (one council_elections row with
-- round_scope='class'), it just also gets class-scoped voting and an
-- automatic advancement step on top.

-- 1. Campaign configuration + overall phase tracker.
create table public.council_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null,
  votes_per_student smallint not null default 1,
  candidates_per_class smallint not null default 1,
  tie_break_mode text not null default 'revote_tied' check (tie_break_mode in ('revote_tied', 'all_advance')),
  has_grade_round boolean not null default false,
  final_round_voters text not null default 'all_students' check (final_round_voters in ('all_students', 'council_members')),
  status text not null default 'class' check (status in ('class', 'grade', 'school', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.council_campaigns enable row level security;

create policy "Own-school can view campaigns" on public.council_campaigns
for select to authenticated
using (school_id = public.current_user_school_id());

create policy "Council staff can manage own-school campaigns" on public.council_campaigns
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'management') or has_role(auth.uid(),'council_advisor')) and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or ((has_role(auth.uid(),'management') or has_role(auth.uid(),'council_advisor')) and school_id = public.current_user_school_id())
);

-- 2. council_elections: a campaign round is just a normal election row,
--    tagged with which campaign/round it belongs to.
alter table public.council_elections
  add column campaign_id uuid references public.council_campaigns(id) on delete cascade,
  add column round_scope text check (round_scope in ('class', 'grade', 'school'));

-- 3. council_candidates: tournament resolution state.
alter table public.council_candidates
  add column round_result text not null default 'pending' check (round_result in ('pending', 'tied', 'advanced', 'eliminated')),
  add column advanced_from_candidate_id uuid references public.council_candidates(id),
  add column advancement_processed boolean not null default false;

-- 4. council_members.role_type gains 'grade_head' (phase 1 only had
--    member/head/newspaper_editor).
alter table public.council_members drop constraint council_members_role_type_check;
alter table public.council_members add constraint council_members_role_type_check
  check (role_type in ('member', 'head', 'grade_head', 'newspaper_editor'));

-- 5. Voter-eligibility helper for campaign rounds - same security-definer
--    pattern as has_active_council_role/is_homeroom_teacher_of.
create or replace function public.can_vote_for_council_campaign_candidate(_voter_id uuid, _candidate_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_election record;
  v_campaign record;
  v_voter_class_id uuid;
  v_voter_grade grade_level;
  v_candidate_class_id uuid;
  v_candidate_grade grade_level;
begin
  select * into v_candidate from council_candidates where id = _candidate_id;
  if v_candidate is null or v_candidate.status <> 'approved' or v_candidate.round_result not in ('pending', 'tied') then
    return false;
  end if;

  select * into v_election from council_elections where id = v_candidate.election_id;
  if v_election is null or v_election.status <> 'voting' or v_election.campaign_id is null then
    return false;
  end if;

  select * into v_campaign from council_campaigns where id = v_election.campaign_id;

  select class_id into v_voter_class_id from profiles where id = _voter_id;
  select class_id into v_candidate_class_id from profiles where id = v_candidate.student_id;

  if v_election.round_scope = 'class' then
    return v_voter_class_id is not null and v_voter_class_id = v_candidate_class_id;
  elsif v_election.round_scope = 'grade' then
    select grade into v_voter_grade from classes where id = v_voter_class_id;
    select grade into v_candidate_grade from classes where id = v_candidate_class_id;
    return v_voter_grade is not null and v_voter_grade = v_candidate_grade;
  else -- 'school'
    if v_campaign.final_round_voters = 'council_members' then
      return public.has_active_council_role(_voter_id, 'member')
        or public.has_active_council_role(_voter_id, 'grade_head')
        or public.has_active_council_role(_voter_id, 'head');
    end if;
    return true;
  end if;
end;
$$;

-- 6. Additive vote policy for campaign rounds (alongside, not replacing, the
--    phase 1/2 policy which still covers plain non-campaign elections).
create policy "Students can vote in council campaign rounds" on public.council_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and public.can_vote_for_council_campaign_candidate(auth.uid(), candidate_id)
  and exists (
    select 1 from council_elections e
    join council_campaigns camp on camp.id = e.campaign_id
    where e.id = election_id
      and (select count(*) from council_votes v2 where v2.election_id = election_id and v2.voter_id = auth.uid()) < camp.votes_per_student
  )
);

-- Campaign rounds allow more than one vote per student (votes_per_student),
-- so the old blanket UNIQUE(election_id, voter_id) on council_votes can't
-- apply to them. Relax it to UNIQUE(election_id, voter_id, candidate_id) -
-- still prevents voting twice for the same candidate. The one-vote-per-
-- student guarantee for plain (non-campaign) elections, which used to come
-- from the constraint being dropped, is re-enforced below directly in that
-- policy's WITH CHECK instead (campaign rounds enforce their own cap via
-- votes_per_student in their own policy above).
alter table public.council_votes drop constraint council_votes_election_id_voter_id_key;
alter table public.council_votes add constraint council_votes_election_voter_candidate_key
  unique (election_id, voter_id, candidate_id);

drop policy if exists "Students can vote once while voting is open" on public.council_votes;
create policy "Students can vote once while voting is open" on public.council_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and exists (select 1 from public.council_elections e where e.id = election_id and e.status = 'voting' and e.school_id = public.current_user_school_id())
  and not exists (select 1 from public.council_votes v2 where v2.election_id = election_id and v2.voter_id = auth.uid())
);

-- 7. The tournament engine. Resolves whatever it can in the campaign's
--    current round, advances winners into the next round (or seats the final
--    winner as council head) once every group in the round is fully decided,
--    and reports back what's still tied so the advisor knows what needs a
--    revote. Safe to call repeatedly - each call only touches
--    pending/tied candidates.
create or replace function public.advance_council_round(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign record;
  v_round_election record;
  v_advance_count int;
  v_tied_count int;
  v_next_status text;
  v_next_election_id uuid;
  v_member_role text;
  v_advanced_count int := 0;
  v_rec record;
begin
  select * into v_campaign from council_campaigns where id = p_campaign_id;
  if v_campaign is null then
    raise exception 'Campaign not found';
  end if;

  if not (
    has_role(auth.uid(), 'system_admin')
    or (has_role(auth.uid(), 'management') and v_campaign.school_id = public.current_user_school_id())
    or (has_role(auth.uid(), 'council_advisor') and v_campaign.school_id = public.current_user_school_id())
  ) then
    raise exception 'Not authorized';
  end if;

  if v_campaign.status = 'closed' then
    return jsonb_build_object('error', 'campaign_closed');
  end if;

  select * into v_round_election from council_elections where campaign_id = p_campaign_id and round_scope = v_campaign.status;
  if v_round_election is null then
    raise exception 'Round election missing for status %', v_campaign.status;
  end if;

  v_advance_count := case v_campaign.status when 'class' then v_campaign.candidates_per_class else 1 end;

  -- Resolve every currently pending/tied candidate in this round in one pass.
  with tallied as (
    select cc.id as candidate_id, cc.student_id, coalesce(vc.cnt, 0)::int as votes,
      case v_campaign.status
        when 'class' then p.class_id::text
        when 'grade' then cl.grade::text
        else 'school'
      end as group_key
    from council_candidates cc
    join profiles p on p.id = cc.student_id
    join classes cl on cl.id = p.class_id
    left join (select candidate_id, count(*) cnt from council_votes where election_id = v_round_election.id group by candidate_id) vc on vc.candidate_id = cc.id
    where cc.election_id = v_round_election.id and cc.round_result in ('pending', 'tied')
  ),
  sized as (
    select *, count(*) over (partition by group_key) as group_size,
      row_number() over (partition by group_key order by votes desc, candidate_id) as rn
    from tallied
  ),
  cutoffs as (
    -- max(...) filter picks the votes value of the row at rn = advance_count in
    -- each group; if the group has fewer candidates than that, filter yields
    -- NULL, which doubles as "everyone in this group advances, no cutoff".
    select group_key, max(votes) filter (where rn = v_advance_count) as cutoff_votes
    from sized
    group by group_key
  ),
  above as (
    select t.group_key, count(*) as cnt
    from tallied t join cutoffs c on c.group_key = t.group_key
    where c.cutoff_votes is not null and t.votes > c.cutoff_votes
    group by t.group_key
  ),
  resolved as (
    select s.candidate_id, c.cutoff_votes,
      coalesce(a.cnt, 0) as above_cutoff_cnt,
      (select count(*) from tallied t3 where t3.group_key = s.group_key and t3.votes = c.cutoff_votes) as tie_count,
      s.votes
    from sized s
    join cutoffs c on c.group_key = s.group_key
    left join above a on a.group_key = s.group_key
  )
  update council_candidates cc set round_result = case
    when r.cutoff_votes is null then 'advanced'
    when r.votes > r.cutoff_votes then 'advanced'
    when r.votes = r.cutoff_votes and v_campaign.tie_break_mode = 'all_advance' then 'advanced'
    when r.votes = r.cutoff_votes and r.tie_count = (v_advance_count - r.above_cutoff_cnt) then 'advanced'
    when r.votes = r.cutoff_votes then 'tied'
    else 'eliminated'
  end
  from resolved r
  where cc.id = r.candidate_id;

  -- revote_tied: free up exactly the voters who chose a still-tied candidate.
  delete from council_votes v using council_candidates cc2
  where v.election_id = v_round_election.id and v.candidate_id = cc2.id and cc2.round_result = 'tied';

  select count(*) into v_tied_count from council_candidates where election_id = v_round_election.id and round_result = 'tied';
  if v_tied_count > 0 then
    return jsonb_build_object('round_closed', false, 'tied_count', v_tied_count);
  end if;

  -- Whole round is decided - close it and advance the campaign.
  update council_elections set status = 'closed' where id = v_round_election.id;

  v_next_status := case v_campaign.status
    when 'class' then (case when v_campaign.has_grade_round then 'grade' else 'school' end)
    when 'grade' then 'school'
    else 'closed'
  end;

  if v_next_status <> 'closed' then
    insert into council_elections (school_id, title, description, status, created_by, campaign_id, round_scope)
    values (
      v_campaign.school_id,
      v_campaign.title || ' - ' || (case v_next_status when 'grade' then 'שלב שכבתי' else 'שלב סופי' end),
      null, 'voting', v_campaign.created_by, p_campaign_id, v_next_status
    )
    returning id into v_next_election_id;
  end if;

  v_member_role := case v_campaign.status when 'class' then 'member' when 'grade' then 'grade_head' else 'head' end;

  for v_rec in
    select id, student_id, statement from council_candidates
    where election_id = v_round_election.id and round_result = 'advanced' and advancement_processed = false
  loop
    if v_member_role = 'head' then
      -- Deactivate whoever currently holds the seat, including v_rec.student_id
      -- themself if they're the incumbent being re-elected - otherwise the
      -- insert below would collide with the one-active-head-per-school index.
      update council_members set is_active = false
        where school_id = v_campaign.school_id and role_type = 'head' and is_active;
    end if;

    insert into council_members (school_id, student_id, role_type, appointed_by, appointment_type, position, is_active)
    values (
      v_campaign.school_id, v_rec.student_id, v_member_role, v_campaign.created_by, 'elected',
      case v_member_role when 'member' then 'חבר/ת מועצה' when 'grade_head' then 'ראש/ת מועצה שכבתי' else 'ראש/ת מועצה' end,
      true
    );

    if v_next_election_id is not null then
      insert into council_candidates (election_id, student_id, statement, status, round_result, advanced_from_candidate_id)
      values (v_next_election_id, v_rec.student_id, v_rec.statement, 'approved', 'pending', v_rec.id);
    end if;

    update council_candidates set advancement_processed = true where id = v_rec.id;

    if v_member_role = 'head' then
      perform public.create_notification(
        v_rec.student_id, 'council_election_won', '🏆 נבחרת כראש/ת המועצה!',
        null, '/dashboard/council', v_campaign.school_id
      );
    end if;

    v_advanced_count := v_advanced_count + 1;
  end loop;

  update council_campaigns set status = v_next_status where id = p_campaign_id;

  return jsonb_build_object('round_closed', true, 'advanced_count', v_advanced_count, 'next_status', v_next_status);
end;
$$;

revoke execute on function public.advance_council_round(uuid) from public, anon;
grant execute on function public.advance_council_round(uuid) to authenticated;
