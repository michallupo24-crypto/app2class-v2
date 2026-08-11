-- 1.2: RLS already restricted counselor_notes SELECT to the owning counselor
-- only (verified: no management/system_admin policy exists on that table).
-- But RLS is not encryption at rest — a superuser DB connection still reads
-- plain text. This adds real encryption for note_content, and — unlike
-- reveal_id_number in 0.2 — the decrypt path has NO admin bypass at all,
-- per spec: "even the system admin must not be able to read session notes".

alter table public.counselor_notes
  add column if not exists note_content_encrypted bytea;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'counselor_notes_key',
  'Symmetric key for encrypting counselor_notes.note_content at rest'
) where not exists (select 1 from vault.secrets where name = 'counselor_notes_key');

create or replace function public.encrypt_counselor_note_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  if NEW.note_content is not null and NEW.note_content <> '' then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'counselor_notes_key' limit 1;
    NEW.note_content_encrypted := pgp_sym_encrypt(NEW.note_content, v_key);
    NEW.note_content := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_encrypt_counselor_note on public.counselor_notes;
create trigger trg_encrypt_counselor_note
  before insert or update on public.counselor_notes
  for each row execute function public.encrypt_counselor_note_trigger();

update public.counselor_notes set note_content = note_content where note_content is not null and note_content <> '';

comment on column public.counselor_notes.note_content is 'Write-only intake field: a trigger encrypts this into note_content_encrypted and always clears it back to null. Never stored in plain text.';

-- Decrypt RPC: deliberately no system_admin/management bypass. Only the
-- counselor who owns the note may ever read it back.
create or replace function public.get_counselor_note(p_note_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
  v_encrypted bytea;
  v_owner uuid;
begin
  select counselor_id, note_content_encrypted into v_owner, v_encrypted
  from public.counselor_notes where id = p_note_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_encrypted is null then
    return null;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'counselor_notes_key' limit 1;
  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

revoke execute on function public.get_counselor_note(uuid) from public, anon;
grant execute on function public.get_counselor_note(uuid) to authenticated;
