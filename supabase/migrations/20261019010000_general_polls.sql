-- General polls ("הצבעות"): any referendum on any topic, for a chosen audience,
-- between open/close dates. The bell-song vote becomes one kind of poll
-- (kind = 'bell_song': students suggest YouTube songs as options).
--
-- Who creates/manages polls: management, system_admin, the council advisor and
-- the active council head - the same set that moderated the bell vote.
--
-- Existing bell_song_suggestions / bell_song_votes rows are copied into a
-- "שיר הצלצול" poll per school (option ids = suggestion ids). The old tables
-- are left in place, unused, so nothing is lost; drop them in a later migration.

-- 1. Tables

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  kind text not null default 'general' check (kind in ('general', 'bell_song')),
  -- who may see and vote: everyone in the school, students (optionally only some grades), staff, or parents
  audience text not null default 'students' check (audience in ('all', 'students', 'staff', 'parents')),
  audience_grades public.grade_level[],
  -- voters may add their own options (the bell-song flow)
  allow_suggestions boolean not null default false,
  -- when voters see the counts: always, once they voted, or only after the poll closes
  show_results text not null default 'after_vote' check (show_results in ('always', 'after_vote', 'after_close')),
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (closes_at is null or closes_at > opens_at)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  media_url text,
  suggested_by uuid references public.profiles(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One vote per voter per poll; voting again moves it (upsert on poll_id, voter_id).
create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

create index idx_polls_school on public.polls(school_id, created_at desc);
create index idx_poll_options_poll on public.poll_options(poll_id);
create index idx_poll_votes_option on public.poll_votes(option_id);

-- 2. Helpers

create or replace function public.can_manage_polls(_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(auth.uid(), 'system_admin')
    or (_school_id = public.current_user_school_id() and (
      has_role(auth.uid(), 'management')
      or has_role(auth.uid(), 'council_advisor')
      or public.has_active_council_role(auth.uid(), 'head')
    ))
$$;

-- Is the poll addressed to the current user (school + audience + grade)?
create or replace function public.poll_is_for_me(_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.polls p
    where p.id = _poll_id
      and p.school_id = public.current_user_school_id()
      and case p.audience
        when 'all' then true
        when 'parents' then has_role(auth.uid(), 'parent')
        when 'staff' then exists (
          select 1 from public.user_roles r
          where r.user_id = auth.uid() and r.role not in ('student', 'parent')
        )
        when 'students' then has_role(auth.uid(), 'student') and (
          p.audience_grades is null
          or cardinality(p.audience_grades) = 0
          or exists (
            select 1 from public.profiles pr join public.classes c on c.id = pr.class_id
            where pr.id = auth.uid() and c.grade = any (p.audience_grades)
          )
        )
        else false
      end
  )
$$;

-- Open for voting/suggesting right now, and addressed to the current user.
create or replace function public.poll_is_open_for_me(_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.poll_is_for_me(_poll_id) and exists (
    select 1 from public.polls p
    where p.id = _poll_id and p.is_active and p.opens_at <= now()
      and (p.closes_at is null or p.closes_at > now())
  )
$$;

revoke execute on function public.can_manage_polls(uuid) from public, anon;
revoke execute on function public.poll_is_for_me(uuid) from public, anon;
revoke execute on function public.poll_is_open_for_me(uuid) from public, anon;
grant execute on function public.can_manage_polls(uuid) to authenticated;
grant execute on function public.poll_is_for_me(uuid) to authenticated;
grant execute on function public.poll_is_open_for_me(uuid) to authenticated;

-- 3. RLS

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "Audience and managers can view polls" on public.polls
for select to authenticated
using (public.can_manage_polls(school_id) or (is_active and public.poll_is_for_me(id)));

create policy "Managers can manage polls" on public.polls
for all to authenticated
using (public.can_manage_polls(school_id))
with check (public.can_manage_polls(school_id));

create policy "Audience and managers can view poll options" on public.poll_options
for select to authenticated
using (exists (
  select 1 from public.polls p where p.id = poll_options.poll_id
    and (public.can_manage_polls(p.school_id) or (p.is_active and public.poll_is_for_me(p.id)))
));

create policy "Managers can manage poll options" on public.poll_options
for all to authenticated
using (exists (select 1 from public.polls p where p.id = poll_options.poll_id and public.can_manage_polls(p.school_id)))
with check (exists (select 1 from public.polls p where p.id = poll_options.poll_id and public.can_manage_polls(p.school_id)));

create policy "Voters can suggest options on open polls" on public.poll_options
for insert to authenticated
with check (
  suggested_by = auth.uid()
  and public.poll_is_open_for_me(poll_id)
  and exists (select 1 from public.polls p where p.id = poll_options.poll_id and p.allow_suggestions)
);

-- Suggesters may withdraw (is_active = false) their own option.
create policy "Suggesters can update own options" on public.poll_options
for update to authenticated
using (suggested_by = auth.uid())
with check (suggested_by = auth.uid());

-- Votes: you see your own; counts come from get_poll_results so individual
-- choices stay private. Managers can see all votes of their school's polls.
create policy "Voters can view own votes" on public.poll_votes
for select to authenticated
using (voter_id = auth.uid());

create policy "Managers can view poll votes" on public.poll_votes
for select to authenticated
using (exists (select 1 from public.polls p where p.id = poll_votes.poll_id and public.can_manage_polls(p.school_id)));

create policy "Voters can vote on open polls" on public.poll_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and public.poll_is_open_for_me(poll_id)
  and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id and o.is_active)
);

create policy "Voters can change vote on open polls" on public.poll_votes
for update to authenticated
using (voter_id = auth.uid() and public.poll_is_open_for_me(poll_id))
with check (
  voter_id = auth.uid()
  and public.poll_is_open_for_me(poll_id)
  and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id and o.is_active)
);

create policy "Voters can withdraw vote on open polls" on public.poll_votes
for delete to authenticated
using (voter_id = auth.uid() and public.poll_is_open_for_me(poll_id));

-- 4. Results: counts per option, respecting show_results for non-managers.
create or replace function public.get_poll_results(_poll_id uuid)
returns table (option_id uuid, votes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, count(v.id)
  from public.polls p
  join public.poll_options o on o.poll_id = p.id
  left join public.poll_votes v on v.option_id = o.id
  where p.id = _poll_id
    and (
      public.can_manage_polls(p.school_id)
      or (p.is_active and public.poll_is_for_me(p.id) and (
        p.show_results = 'always'
        or (p.show_results = 'after_vote' and exists (select 1 from public.poll_votes mv where mv.poll_id = p.id and mv.voter_id = auth.uid()))
        or (p.closes_at is not null and p.closes_at <= now())
      ))
    )
  group by o.id
$$;

revoke execute on function public.get_poll_results(uuid) from public, anon;
grant execute on function public.get_poll_results(uuid) to authenticated;

-- 5. Carry the existing bell-song vote over: one poll per school that has suggestions.
do $$
declare
  s record;
  new_poll uuid;
begin
  for s in select distinct school_id from public.bell_song_suggestions loop
    insert into public.polls (school_id, title, description, kind, audience, allow_suggestions, show_results)
    values (s.school_id, 'שיר הצלצול', 'הציעו שיר לצלצול בית הספר והצביעו למועדף עליכם', 'bell_song', 'all', true, 'always')
    returning id into new_poll;

    insert into public.poll_options (id, poll_id, label, media_url, suggested_by, is_active, created_at)
    select b.id, new_poll, b.title, b.youtube_url,
      case when exists (select 1 from public.profiles pr where pr.id = b.suggested_by) then b.suggested_by end,
      b.is_active, b.created_at
    from public.bell_song_suggestions b
    where b.school_id = s.school_id;

    insert into public.poll_votes (poll_id, option_id, voter_id, created_at)
    select new_poll, v.suggestion_id, v.voter_id, v.created_at
    from public.bell_song_votes v
    join public.bell_song_suggestions b on b.id = v.suggestion_id
    where b.school_id = s.school_id
      and exists (select 1 from public.profiles pr where pr.id = v.voter_id);
  end loop;
end $$;

comment on table public.bell_song_suggestions is 'Deprecated: migrated into polls (kind = bell_song) by 20261019010000_general_polls.';
comment on table public.bell_song_votes is 'Deprecated: migrated into poll_votes by 20261019010000_general_polls.';
