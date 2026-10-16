-- The redesigned avatar editor adds freckles (none / light / many).
-- The app keeps working before this runs: it selects avatars with "*" and
-- saves without the column if the database doesn't have it yet.
alter table public.avatars add column if not exists freckles text not null default 'none';
