-- 0.6 (1/2): system_admin currently plays both "runs my school" and
-- "owns the whole platform" roles. Add a distinct super_admin value so
-- platform-root actions (kill-switch, creating new schools) can require it
-- specifically. Enum value added in its own migration: Postgres forbids
-- using a new enum value in the same transaction that adds it.
alter type public.app_role add value if not exists 'super_admin';
