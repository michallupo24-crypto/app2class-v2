-- New staff roles, part 3/4.
alter type public.app_role add value if not exists 'parent_committee_rep';
