-- Removes one stray test campaign accidentally created during this feature's
-- own development/verification (title ".", garbled description "חלךנ"),
-- which had already been left in the 'voting' phase with zero real
-- candidates - it was blocking a real council advisor from opening a usable
-- election, since it looked like an active-but-broken round in the UI.
-- council_elections/council_candidates/council_votes all cascade-delete from
-- council_campaigns, so removing this one row is a complete cleanup.
delete from public.council_campaigns where id = '0ebc991e-9d40-4c38-b481-3f31f9963e03';
