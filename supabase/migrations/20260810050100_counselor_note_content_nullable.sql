-- note_content was NOT NULL in the original table, which breaks the encrypt
-- trigger's blank-out-after-encrypt step (0.2 used the same write-only
-- intake pattern on a nullable column; this one wasn't nullable yet).
alter table public.counselor_notes alter column note_content drop not null;
