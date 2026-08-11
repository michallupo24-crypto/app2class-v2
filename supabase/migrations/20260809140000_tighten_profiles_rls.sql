-- 20260412000000_unlock_all_profiles_rls.sql fixed an RLS-recursion bug by opening
-- public.profiles to `USING (true)` with no role restriction - which also made every
-- profile row (names, emails, phone numbers) readable by anonymous/unauthenticated
-- requests. This tightens it back to "any logged-in user" without reintroducing the
-- self-referential subquery that caused the original recursion (42P17).

DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
