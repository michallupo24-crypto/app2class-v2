-- Security fix: get_counselor_note and reveal_id_number used a bare
-- `x <> auth.uid()` / `auth.uid() = y` comparison inside an OR/NOT
-- expression. In SQL, any comparison against NULL yields NULL rather than
-- true/false, and `if not (... or NULL) then` does not raise in plpgsql —
-- so if auth.uid() ever evaluated to NULL, both authorization checks would
-- silently pass instead of denying access. Rewritten to fail closed.

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
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select counselor_id, note_content_encrypted into v_owner, v_encrypted
  from public.counselor_notes where id = p_note_id;

  if v_owner is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_encrypted is null then
    return null;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'counselor_notes_key' limit 1;
  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

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
