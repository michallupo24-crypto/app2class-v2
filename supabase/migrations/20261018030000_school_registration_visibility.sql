-- QA and demo schools ("בית ספר בדיקה - מערכת שעות QA", "בית ספר הדגמה")
-- showed up in the public registration dropdown next to real schools.
-- Registration now lists only schools open for registration; the system
-- admin still sees all of them.
alter table public.schools
  add column if not exists open_for_registration boolean not null default true;

update public.schools
set open_for_registration = false
where name like 'בית ספר בדיקה%' or name = 'בית ספר הדגמה';
