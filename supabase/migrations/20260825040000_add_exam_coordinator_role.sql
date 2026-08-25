-- New staff roles, part 1/4: enum values must each be added in their own
-- migration (Postgres forbids using a new enum value in the same
-- transaction that adds it) - see the council_advisor precedent.
alter type public.app_role add value if not exists 'exam_coordinator';
