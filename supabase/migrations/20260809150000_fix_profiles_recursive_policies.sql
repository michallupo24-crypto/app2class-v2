-- Two more recursion sources on public.profiles surfaced after the move to a fresh
-- project (42P17, same symptom as 20260809140000, different policies):
--
-- "Management can view school profiles" (from 20260326000002_stage13_admin.sql) and
-- "Parents can view staff profiles for their children" (from the parent-visibility
-- fix) both reference public.profiles directly - via a correlated subquery and a
-- self-join respectively - from within a policy defined ON public.profiles. Any
-- reference to profiles from inside its own policy re-triggers RLS evaluation on
-- profiles, which re-evaluates every policy on the table, including itself.
--
-- "Authenticated users can view profiles" (USING (true)) already grants every
-- authenticated user access to every profile, so both of these are redundant on
-- top of being broken - just drop them instead of rewriting them to route through
-- a SECURITY DEFINER function.

DROP POLICY IF EXISTS "Management can view school profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view staff profiles for their children" ON public.profiles;
