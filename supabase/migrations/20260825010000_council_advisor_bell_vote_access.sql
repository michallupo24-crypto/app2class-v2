-- The council advisor was never actually given moderation access to bell-song
-- suggestions (only management/system_admin/council head) - extend the same
-- FOR ALL policy to include council_advisor, matching how every other
-- council-related permission in this app has been scoped so far.
drop policy if exists "Management can manage own-school song suggestions" on public.bell_song_suggestions;
create policy "Management can manage own-school song suggestions" on public.bell_song_suggestions
for all to authenticated
using (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (has_role(auth.uid(),'council_advisor') and school_id = public.current_user_school_id())
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
)
with check (
  has_role(auth.uid(),'system_admin')
  or (has_role(auth.uid(),'management') and school_id = public.current_user_school_id())
  or (has_role(auth.uid(),'council_advisor') and school_id = public.current_user_school_id())
  or (public.has_active_council_role(auth.uid(), 'head') and school_id = public.current_user_school_id())
);
