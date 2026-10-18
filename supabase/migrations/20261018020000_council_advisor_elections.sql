-- The council advisor ("אחראית מועצה") is the role the principal assigns to run
-- the student council, and the council page tells students "when the council
-- advisor opens new elections" - but only management could create elections
-- or move them to voting. Advisors may now manage their own school's elections.
drop policy if exists "Council advisors can manage own-school elections" on public.council_elections;
create policy "Council advisors can manage own-school elections" on public.council_elections
for all to authenticated
using (has_role(auth.uid(), 'council_advisor') and school_id = public.current_user_school_id())
with check (has_role(auth.uid(), 'council_advisor') and school_id = public.current_user_school_id());
