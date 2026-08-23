-- A room can legitimately host more than one class at once (e.g. a gym with
-- 5 classes doing PE simultaneously). "capacity" now means "how many classes
-- can use this space at the same time" - the number that actually drives
-- scheduling - rather than a vague student headcount. Existing NULLs become
-- 1 (a normal single-class room).
update public.rooms set capacity = 1 where capacity is null;
alter table public.rooms alter column capacity set default 1;
alter table public.rooms alter column capacity set not null;

-- The old index assumed a room can only ever hold ONE class at a time, which
-- is exactly the wrong assumption for shared spaces. Concurrency is now
-- enforced by the app/generator against rooms.capacity instead of a hard
-- one-row-per-slot DB rule.
drop index if exists timetable_slots_room_slot_unique;
