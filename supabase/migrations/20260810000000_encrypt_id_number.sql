-- 0.2: id_number was stored as plain text despite a comment claiming it was
-- encrypted/hashed. This adds real encryption at rest: the plaintext column
-- becomes a write-only intake field that a trigger immediately encrypts
-- (pgp_sym_encrypt) and hashes (hmac) into dedicated columns, then blanks.
-- The symmetric key lives only in Supabase Vault, generated server-side so
-- it never appears in migration history or client code.

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'id_number_key',
  'Symmetric key for encrypting profiles.id_number at rest'
) where not exists (select 1 from vault.secrets where name = 'id_number_key');

alter table public.profiles
  add column if not exists id_number_encrypted bytea,
  add column if not exists id_number_hash text;

create index if not exists idx_profiles_id_number_hash on public.profiles(id_number_hash);

create or replace function public.encrypt_id_number_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  if NEW.id_number is not null and NEW.id_number <> '' then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
    NEW.id_number_encrypted := pgp_sym_encrypt(NEW.id_number, v_key);
    NEW.id_number_hash := encode(hmac(NEW.id_number, v_key, 'sha256'), 'hex');
    NEW.id_number := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_encrypt_id_number on public.profiles;
create trigger trg_encrypt_id_number
  before insert or update on public.profiles
  for each row execute function public.encrypt_id_number_trigger();

-- Backfill: re-save any already-stored plaintext id numbers through the trigger.
update public.profiles set id_number = id_number where id_number is not null and id_number <> '';

comment on column public.profiles.id_number is 'Write-only intake field: a trigger encrypts+hashes on write and always clears this back to null. Never stored in plain text.';

-- Lookup RPC replaces direct plaintext equality queries against id_number.
create or replace function public.find_student_by_id_number(p_id_number text, p_school_id uuid)
returns table(id uuid, full_name text)
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
  v_hash text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
  v_hash := encode(hmac(p_id_number, v_key, 'sha256'), 'hex');
  return query
    select p.id, p.full_name from public.profiles p
    where p.school_id = p_school_id and p.id_number_hash = v_hash
    limit 1;
end;
$$;

grant execute on function public.find_student_by_id_number(text, uuid) to anon, authenticated;

-- Decrypt RPC for authorized staff who need to read the real value back
-- (e.g. correcting a typo). Restricted to roles that could already see PII.
create or replace function public.reveal_id_number(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
  v_encrypted bytea;
begin
  if not (
    has_role(auth.uid(), 'system_admin'::app_role) or
    has_role(auth.uid(), 'management'::app_role) or
    has_role(auth.uid(), 'educator'::app_role) or
    has_role(auth.uid(), 'grade_coordinator'::app_role) or
    auth.uid() = p_profile_id
  ) then
    raise exception 'Not authorized';
  end if;

  select id_number_encrypted into v_encrypted from public.profiles where id = p_profile_id;
  if v_encrypted is null then
    return null;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

grant execute on function public.reveal_id_number(uuid) to authenticated;

revoke execute on function public.encrypt_id_number_trigger() from public, anon, authenticated;
