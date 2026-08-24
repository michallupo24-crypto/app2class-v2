-- Student council feature, phase 1: management needs to be able to appoint a
-- staff member as "council advisor" (אחראית מועצה), who in turn appoints a
-- council head and newspaper editor from the student body. Enum value added
-- in its own migration: Postgres forbids using a new enum value in the same
-- transaction that adds it (see 20260810020000_add_super_admin_role.sql).
alter type public.app_role add value if not exists 'council_advisor';
