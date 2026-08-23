-- Follow-up pass promised (but never done) in 20260813000000_scope_school_rls.sql,
-- plus a same-school check on reveal_id_number() which only ever got the
-- NULL-auth-bypass fix (20260810050200), never the cross-school check.
-- Reuses public.current_user_school_id() from 20260813000000.

-- 0. reveal_id_number: any educator/grade_coordinator/management could decrypt
--    a student's national ID from ANY school, not just their own.
create or replace function public.reveal_id_number(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
  v_encrypted bytea;
  v_target_school uuid;
begin
  if auth.uid() = p_profile_id then
    select id_number_encrypted into v_encrypted from public.profiles where id = p_profile_id;
  elsif (
    has_role(auth.uid(), 'system_admin'::app_role) or
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'educator'::app_role) or
    has_role(auth.uid(), 'grade_coordinator'::app_role)
  ) then
    select school_id, id_number_encrypted into v_target_school, v_encrypted
    from public.profiles where id = p_profile_id;

    if not has_role(auth.uid(), 'system_admin'::app_role)
       and (v_target_school is null or v_target_school <> public.current_user_school_id()) then
      raise exception 'Not authorized';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  if v_encrypted is null then
    return null;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

-- 1. council_members
drop policy if exists "Authenticated can view council members" on public.council_members;
create policy "Users can view own-school council members" on public.council_members
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Management can manage council members" on public.council_members;
create policy "Management can manage own-school council members" on public.council_members
for all to authenticated
using (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()))
with check (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()));

-- 2. council_elections
drop policy if exists "Authenticated can view elections" on public.council_elections;
create policy "Users can view own-school elections" on public.council_elections
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Management can manage elections" on public.council_elections;
create policy "Management can manage own-school elections" on public.council_elections
for all to authenticated
using (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()))
with check (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()));

-- 3. council_candidates (school via election_id)
drop policy if exists "Authenticated can view candidates" on public.council_candidates;
create policy "Users can view own-school candidates" on public.council_candidates
for select to authenticated
using (exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()));

drop policy if exists "Students can self-nominate during nominations" on public.council_candidates;
create policy "Students can self-nominate during nominations" on public.council_candidates
for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (select 1 from public.council_elections e where e.id = election_id and e.status = 'nominations' and e.school_id = public.current_user_school_id())
);

drop policy if exists "Management can manage candidates" on public.council_candidates;
create policy "Management can manage own-school candidates" on public.council_candidates
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = council_candidates.election_id and e.school_id = public.current_user_school_id()))
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = election_id and e.school_id = public.current_user_school_id()))
);

-- 4. council_votes (school via election_id)
drop policy if exists "Students can vote once while voting is open" on public.council_votes;
create policy "Students can vote once while voting is open" on public.council_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and exists (select 1 from public.council_elections e where e.id = election_id and e.status = 'voting' and e.school_id = public.current_user_school_id())
);

drop policy if exists "Everyone can view votes on closed elections" on public.council_votes;
create policy "Own-school can view votes on closed elections" on public.council_votes
for select to authenticated
using (exists (select 1 from public.council_elections e where e.id = council_votes.election_id and e.status = 'closed' and e.school_id = public.current_user_school_id()));

drop policy if exists "Management can view all votes" on public.council_votes;
create policy "Management can view own-school votes" on public.council_votes
for select to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and exists (select 1 from public.council_elections e where e.id = council_votes.election_id and e.school_id = public.current_user_school_id()))
);

-- 5. newspaper_articles
drop policy if exists "Everyone can view published articles" on public.newspaper_articles;
create policy "Own-school can view published articles" on public.newspaper_articles
for select to authenticated
using (status = 'published' and school_id = public.current_user_school_id());

drop policy if exists "Staff can view all articles for review" on public.newspaper_articles;
create policy "Staff can view own-school articles for review" on public.newspaper_articles
for select to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'counselor'))
  and school_id = public.current_user_school_id()
);

drop policy if exists "Authenticated can submit article drafts" on public.newspaper_articles;
create policy "Authenticated can submit own-school article drafts" on public.newspaper_articles
for insert to authenticated
with check (author_id = auth.uid() and status = 'draft' and school_id = public.current_user_school_id());

drop policy if exists "Staff can review and publish articles" on public.newspaper_articles;
create policy "Staff can review and publish own-school articles" on public.newspaper_articles
for update to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'counselor'))
  and school_id = public.current_user_school_id()
);

-- 6. newspaper_article_likes (school via article_id)
drop policy if exists "Authenticated can view likes" on public.newspaper_article_likes;
create policy "Own-school can view likes" on public.newspaper_article_likes
for select to authenticated
using (exists (select 1 from public.newspaper_articles a where a.id = newspaper_article_likes.article_id and a.school_id = public.current_user_school_id()));

-- 7. bell_song_suggestions
drop policy if exists "Authenticated can view song suggestions" on public.bell_song_suggestions;
create policy "Own-school can view song suggestions" on public.bell_song_suggestions
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Authenticated can suggest songs" on public.bell_song_suggestions;
create policy "Authenticated can suggest own-school songs" on public.bell_song_suggestions
for insert to authenticated
with check (suggested_by = auth.uid() and school_id = public.current_user_school_id());

drop policy if exists "Management can manage song suggestions" on public.bell_song_suggestions;
create policy "Management can manage own-school song suggestions" on public.bell_song_suggestions
for all to authenticated
using (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()))
with check (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()));

-- 8. bell_song_votes (school via suggestion_id)
drop policy if exists "Authenticated can view song votes" on public.bell_song_votes;
create policy "Own-school can view song votes" on public.bell_song_votes
for select to authenticated
using (exists (select 1 from public.bell_song_suggestions s where s.id = bell_song_votes.suggestion_id and s.school_id = public.current_user_school_id()));

-- 9. factions
drop policy if exists "Authenticated can view factions" on public.factions;
create policy "Own-school can view factions" on public.factions
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Admin can manage factions" on public.factions;
create policy "Admin can manage own-school factions" on public.factions
for all to authenticated
using (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()))
with check (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()));

-- 10. faction_members (school via faction_id)
drop policy if exists "Members can view faction members" on public.faction_members;
create policy "Own-school can view faction members" on public.faction_members
for select to authenticated
using (exists (select 1 from public.factions f where f.id = faction_members.faction_id and f.school_id = public.current_user_school_id()));

drop policy if exists "Users can join factions" on public.faction_members;
create policy "Users can join own-school factions" on public.faction_members
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.factions f where f.id = faction_id and f.school_id = public.current_user_school_id())
);

-- 11. flower_votes (school via post_id/comment_id -> faction_posts/faction_comments -> factions)
drop policy if exists "Users can view own votes" on public.flower_votes;
create policy "Own-school can view flower votes" on public.flower_votes
for select to authenticated
using (
  exists (
    select 1 from public.faction_posts p join public.factions f on f.id = p.faction_id
    where p.id = flower_votes.post_id and f.school_id = public.current_user_school_id()
  )
  or exists (
    select 1 from public.faction_comments c
    join public.faction_posts p on p.id = c.post_id
    join public.factions f on f.id = p.faction_id
    where c.id = flower_votes.comment_id and f.school_id = public.current_user_school_id()
  )
);

-- 12. live_sessions
drop policy if exists "Staff can view live sessions" on public.live_sessions;
create policy "Staff can view own-school live sessions" on public.live_sessions
for select to authenticated
using (
  (has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin') or has_role(auth.uid(),'grade_coordinator'))
  and school_id = public.current_user_school_id()
);

-- 13. live_question_votes (school via question_id -> live_questions -> live_sessions)
drop policy if exists "Users can view votes" on public.live_question_votes;
create policy "Own-school can view question votes" on public.live_question_votes
for select to authenticated
using (
  exists (
    select 1 from public.live_questions q join public.live_sessions s on s.id = q.session_id
    where q.id = live_question_votes.question_id and s.school_id = public.current_user_school_id()
  )
);

-- 14. user_badges / user_streaks / user_reliability (school via user_id -> profiles)
drop policy if exists "Users can view all badges" on public.user_badges;
create policy "Own-school can view badges" on public.user_badges
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = user_badges.user_id and p.school_id = public.current_user_school_id()));

drop policy if exists "Users can view all streaks" on public.user_streaks;
create policy "Own-school can view streaks" on public.user_streaks
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = user_streaks.user_id and p.school_id = public.current_user_school_id()));

drop policy if exists "Users can view all reliability" on public.user_reliability;
create policy "Own-school can view reliability" on public.user_reliability
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = user_reliability.user_id and p.school_id = public.current_user_school_id()));

drop policy if exists "Staff can update reliability" on public.user_reliability;
create policy "Staff can update own-school reliability" on public.user_reliability
for update to authenticated
using (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and exists (select 1 from public.profiles p where p.id = user_reliability.user_id and p.school_id = public.current_user_school_id())
)
with check (
  (has_role(auth.uid(),'educator') or has_role(auth.uid(),'grade_coordinator') or has_role(auth.uid(),'management') or has_role(auth.uid(),'system_admin'))
  and exists (select 1 from public.profiles p where p.id = user_reliability.user_id and p.school_id = public.current_user_school_id())
);

-- 15. chat_settings
drop policy if exists "Authenticated can view chat settings" on public.chat_settings;
create policy "Own-school can view chat settings" on public.chat_settings
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Management can manage chat settings" on public.chat_settings;
create policy "Management can manage own-school chat settings" on public.chat_settings
for all to authenticated
using (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()))
with check (has_role(auth.uid(),'system_admin') or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id()));

-- 16. syllabi
drop policy if exists "Syllabi are viewable by authenticated" on public.syllabi;
create policy "Own-school syllabi are viewable by authenticated" on public.syllabi
for select to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "Subject coordinators can manage syllabi" on public.syllabi;
create policy "Subject coordinators can manage own-school syllabi" on public.syllabi
for all to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'subject_coordinator')
  and school_id = public.current_user_school_id()
)
with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'subject_coordinator')
  and school_id = public.current_user_school_id()
);

-- 17. class_syllabus_progress (school via class_id)
drop policy if exists "Class syllabus progress viewable by authenticated" on public.class_syllabus_progress;
create policy "Own-school class syllabus progress viewable by authenticated" on public.class_syllabus_progress
for select to authenticated
using (exists (select 1 from public.classes c where c.id = class_syllabus_progress.class_id and c.school_id = public.current_user_school_id()));

drop policy if exists "Teachers can update class progress" on public.class_syllabus_progress;
create policy "Teachers can update own-school class progress" on public.class_syllabus_progress
for all to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('educator','professional_teacher'))
  and exists (select 1 from public.classes c where c.id = class_syllabus_progress.class_id and c.school_id = public.current_user_school_id())
)
with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('educator','professional_teacher'))
  and exists (select 1 from public.classes c where c.id = class_syllabus_progress.class_id and c.school_id = public.current_user_school_id())
);

-- 18. school_events (school_id nullable = global by design, same pattern as faq_items/system_announcements)
drop policy if exists "School events viewable by authenticated" on public.school_events;
create policy "Users can view global and own-school events" on public.school_events
for select to authenticated
using (school_id is null or school_id = public.current_user_school_id());

drop policy if exists "Admins can manage school events" on public.school_events;
create policy "Admins can manage global and own-school events" on public.school_events
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
);
