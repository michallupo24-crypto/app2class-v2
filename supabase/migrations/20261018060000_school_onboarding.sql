-- School onboarding: a principal applies through a form (school details,
-- grades and classes, subjects with scope / tracks / ability groups, rooms,
-- teachers, timetable constraints, roles, guidelines, history imports); a
-- system admin approves, and approval builds the school from the application.
-- Afterwards the principal keeps editing all of it from the school settings.

-- ── Schools ──────────────────────────────────────────────
alter table public.schools
  add column if not exists city text,
  add column if not exists institution_code text,
  add column if not exists approved_at timestamptz;

-- ── Helpers ──────────────────────────────────────────────
create or replace function public.is_school_manager(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_school_id is not null
    and p_school_id = public.current_user_school_id()
    and public.has_role(auth.uid(), 'management'::app_role)
$$;
revoke execute on function public.is_school_manager(uuid) from public, anon;
grant execute on function public.is_school_manager(uuid) to authenticated;

-- ── Applications ─────────────────────────────────────────
create table if not exists public.school_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users (id) on delete cascade,
  applicant_name text not null,
  applicant_email text,
  applicant_phone text,
  school_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_applications_status_idx on public.school_applications (status, submitted_at desc);

alter table public.school_applications enable row level security;

drop policy if exists "Applicant reads own school application" on public.school_applications;
create policy "Applicant reads own school application" on public.school_applications
for select to authenticated
using (applicant_id = auth.uid() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Applicant creates own school application" on public.school_applications;
create policy "Applicant creates own school application" on public.school_applications
for insert to authenticated
with check (applicant_id = auth.uid() and status in ('draft', 'pending'));

-- The applicant edits while the application is a draft or waiting; approving
-- and rejecting go through the RPCs below.
drop policy if exists "Applicant edits own open school application" on public.school_applications;
create policy "Applicant edits own open school application" on public.school_applications
for update to authenticated
using (applicant_id = auth.uid() and status in ('draft', 'pending', 'rejected'))
with check (applicant_id = auth.uid() and status in ('draft', 'pending'));

drop policy if exists "System admin manages school applications" on public.school_applications;
create policy "System admin manages school applications" on public.school_applications
for all to authenticated
using (public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.has_role(auth.uid(), 'system_admin'::app_role));

-- ── Settings & guidelines ────────────────────────────────
create table if not exists public.school_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  guidelines jsonb not null default '{}'::jsonb,
  enabled_roles text[] not null default array['grade_coordinator', 'subject_coordinator', 'counselor', 'secretary', 'council_advisor', 'exam_coordinator'],
  timetable_constraints jsonb not null default '[]'::jsonb,
  grades text[] not null default array['ז', 'ח', 'ט', 'י', 'יא', 'יב'],
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
alter table public.school_settings enable row level security;

drop policy if exists "School members read school settings" on public.school_settings;
create policy "School members read school settings" on public.school_settings
for select to authenticated
using (school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Managers edit school settings" on public.school_settings;
create policy "Managers edit school settings" on public.school_settings
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

-- Chat hours in the guidelines drive the existing quiet hours.
create or replace function public.sync_chat_settings_from_guidelines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat jsonb := coalesce(NEW.guidelines -> 'chat', '{}'::jsonb);
begin
  if v_chat ? 'allowedFrom' and v_chat ? 'allowedUntil' then
    insert into public.chat_settings (school_id, quiet_hours_start, quiet_hours_end, quiet_hours_enabled, updated_at)
    values (
      NEW.school_id,
      (v_chat ->> 'allowedUntil')::time,
      (v_chat ->> 'allowedFrom')::time,
      coalesce((v_chat ->> 'limitHours')::boolean, true),
      now()
    )
    on conflict (school_id) do update set
      quiet_hours_start = excluded.quiet_hours_start,
      quiet_hours_end = excluded.quiet_hours_end,
      quiet_hours_enabled = excluded.quiet_hours_enabled,
      updated_at = now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_school_settings_chat on public.school_settings;
create trigger trg_school_settings_chat
  after insert or update of guidelines on public.school_settings
  for each row execute function public.sync_chat_settings_from_guidelines();

-- ── Subjects ─────────────────────────────────────────────
create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  sticker_subject text,
  logo_url text,
  logo_mode text not null default 'catalog' check (logo_mode in ('catalog', 'upload', 'design_request')),
  scope text not null default 'school' check (scope in ('school', 'middle', 'high', 'grades')),
  grades text[] not null default '{}',
  kind text not null default 'regular' check (kind in ('regular', 'track', 'ability_group')),
  -- ability_group: {"levels": ["א", "ב"]}; track: {"tracks": [{"name": ..., "sticker": ..., "logoUrl": ...}]}
  options jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.school_subjects enable row level security;

drop policy if exists "School members read school subjects" on public.school_subjects;
create policy "School members read school subjects" on public.school_subjects
for select to authenticated
using (school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Managers edit school subjects" on public.school_subjects;
create policy "Managers edit school subjects" on public.school_subjects
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

-- ── Rooms ────────────────────────────────────────────────
create table if not exists public.school_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  kind text,
  capacity int,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.school_rooms enable row level security;

drop policy if exists "School members read school rooms" on public.school_rooms;
create policy "School members read school rooms" on public.school_rooms
for select to authenticated
using (school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Managers edit school rooms" on public.school_rooms;
create policy "Managers edit school rooms" on public.school_rooms
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

-- ── Staff roster (teachers listed before they register) ──
create table if not exists public.school_staff_roster (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  email text,
  subjects text[] not null default '{}',
  role text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.school_staff_roster enable row level security;

drop policy if exists "Staff read school roster" on public.school_staff_roster;
create policy "Staff read school roster" on public.school_staff_roster
for select to authenticated
using (
  (school_id = public.current_user_school_id()
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role not in ('student', 'parent')))
  or public.has_role(auth.uid(), 'system_admin'::app_role)
);

drop policy if exists "Managers edit school roster" on public.school_staff_roster;
create policy "Managers edit school roster" on public.school_staff_roster
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

-- A teacher who registers with the email the principal listed is matched to
-- the roster row.
create or replace function public.link_staff_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.school_id is not null and NEW.email is not null
     and (TG_OP = 'INSERT' or NEW.school_id is distinct from OLD.school_id) then
    update public.school_staff_roster
    set user_id = NEW.id
    where school_id = NEW.school_id and user_id is null and lower(email) = lower(NEW.email);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_link_staff_roster on public.profiles;
create trigger trg_link_staff_roster
  after insert or update of school_id on public.profiles
  for each row execute function public.link_staff_roster();

-- ── Custom roles ─────────────────────────────────────────
-- A custom role is a named bundle of areas. Each area grants the matching
-- built-in role, so the permission is enforced by the existing RLS.
create table if not exists public.school_custom_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  areas text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.school_custom_roles enable row level security;

create table if not exists public.school_custom_role_members (
  role_id uuid not null references public.school_custom_roles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (role_id, user_id)
);
alter table public.school_custom_role_members enable row level security;

drop policy if exists "School members read custom roles" on public.school_custom_roles;
create policy "School members read custom roles" on public.school_custom_roles
for select to authenticated
using (school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Managers edit custom roles" on public.school_custom_roles;
create policy "Managers edit custom roles" on public.school_custom_roles
for all to authenticated
using (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role))
with check (public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "School members read custom role members" on public.school_custom_role_members;
create policy "School members read custom role members" on public.school_custom_role_members
for select to authenticated
using (exists (
  select 1 from public.school_custom_roles r
  where r.id = role_id and (r.school_id = public.current_user_school_id() or public.has_role(auth.uid(), 'system_admin'::app_role))
));

alter table public.user_roles add column if not exists custom_role_id uuid references public.school_custom_roles (id) on delete set null;

create or replace function public.custom_area_role(p_area text)
returns app_role
language sql
immutable
as $$
  select case p_area
    when 'council' then 'council_advisor'
    when 'exams' then 'exam_coordinator'
    when 'office' then 'secretary'
    when 'counseling' then 'counselor'
    when 'management' then 'management'
  end::app_role
$$;

create or replace function public.set_custom_role_member(p_role_id uuid, p_user_id uuid, p_assign boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.school_custom_roles;
  v_area text;
begin
  select * into v_role from public.school_custom_roles where id = p_role_id;
  if v_role.id is null then raise exception 'role not found'; end if;
  if not (public.is_school_manager(v_role.school_id) or public.has_role(auth.uid(), 'system_admin'::app_role)) then
    raise exception 'only the school management can assign roles';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and school_id = v_role.school_id) then
    raise exception 'user is not in this school';
  end if;

  if p_assign then
    insert into public.school_custom_role_members (role_id, user_id) values (p_role_id, p_user_id) on conflict do nothing;
    foreach v_area in array v_role.areas loop
      if public.custom_area_role(v_area) is not null then
        insert into public.user_roles (user_id, role, custom_role_id)
        values (p_user_id, public.custom_area_role(v_area), p_role_id)
        on conflict (user_id, role) do nothing;
      end if;
    end loop;
  else
    delete from public.school_custom_role_members where role_id = p_role_id and user_id = p_user_id;
    -- Only roles this custom role granted are taken back.
    delete from public.user_roles where user_id = p_user_id and custom_role_id = p_role_id;
  end if;
end;
$$;
revoke execute on function public.set_custom_role_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_custom_role_member(uuid, uuid, boolean) to authenticated;

-- ── Imported history (past grades and behavior) ──────────
create table if not exists public.school_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  application_id uuid references public.school_applications (id) on delete cascade,
  kind text not null check (kind in ('grades', 'behavior', 'students', 'other')),
  file_path text not null,
  file_name text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processed', 'failed')),
  row_count int,
  error text,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.school_imports enable row level security;

drop policy if exists "Uploader and managers read imports" on public.school_imports;
create policy "Uploader and managers read imports" on public.school_imports
for select to authenticated
using (created_by = auth.uid() or public.is_school_manager(school_id) or public.has_role(auth.uid(), 'system_admin'::app_role));

drop policy if exists "Uploader creates imports" on public.school_imports;
create policy "Uploader creates imports" on public.school_imports
for insert to authenticated
with check (created_by = auth.uid() and (school_id is null or public.is_school_manager(school_id)));

drop policy if exists "Uploader and managers update imports" on public.school_imports;
create policy "Uploader and managers update imports" on public.school_imports
for update to authenticated
using (created_by = auth.uid() or public.is_school_manager(school_id))
with check (created_by = auth.uid() or public.is_school_manager(school_id));

drop policy if exists "Uploader and managers delete imports" on public.school_imports;
create policy "Uploader and managers delete imports" on public.school_imports
for delete to authenticated
using (created_by = auth.uid() or public.is_school_manager(school_id));

create table if not exists public.student_history_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  import_id uuid references public.school_imports (id) on delete set null,
  student_id uuid references auth.users (id) on delete set null,
  student_key_hash text,          -- hmac of the ID number, same key as profiles.id_number_hash
  student_name text not null,
  record_type text not null check (record_type in ('grade', 'behavior')),
  grade_level text,               -- ז..יב: the grade the record belongs to
  school_year text,               -- e.g. תשפ"ה / 2025
  subject text,
  score numeric,
  note text,
  occurred_on date,
  created_at timestamptz not null default now()
);
create index if not exists student_history_student_idx on public.student_history_records (student_id);
create index if not exists student_history_school_idx on public.student_history_records (school_id, student_key_hash);
alter table public.student_history_records enable row level security;

drop policy if exists "Staff, student and parents read history" on public.student_history_records;
create policy "Staff, student and parents read history" on public.student_history_records
for select to authenticated
using (
  (school_id = public.current_user_school_id()
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role not in ('student', 'parent')))
  or student_id = auth.uid()
  or exists (select 1 from public.parent_student ps where ps.parent_id = auth.uid() and ps.student_id = student_history_records.student_id)
  or public.has_role(auth.uid(), 'system_admin'::app_role)
);

drop policy if exists "Managers write history" on public.student_history_records;
create policy "Managers write history" on public.student_history_records
for all to authenticated
using (public.is_school_manager(school_id))
with check (public.is_school_manager(school_id));

-- Rows arrive with a plain ID number; hash it on write and never store it.
alter table public.student_history_records add column if not exists student_id_number text;
create or replace function public.hash_history_id_number()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  if NEW.student_id_number is not null and btrim(NEW.student_id_number) <> '' then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'id_number_key' limit 1;
    NEW.student_key_hash := encode(hmac(lpad(btrim(NEW.student_id_number), 9, '0'), v_key, 'sha256'), 'hex');
  end if;
  NEW.student_id_number := null;
  return NEW;
end;
$$;
drop trigger if exists trg_hash_history_id_number on public.student_history_records;
create trigger trg_hash_history_id_number
  before insert or update on public.student_history_records
  for each row execute function public.hash_history_id_number();

-- Match imported rows to registered students: by ID number when present,
-- else by exact full name within the school.
create or replace function public.link_student_history(p_school_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
  v_m integer := 0;
begin
  if not (public.is_school_manager(p_school_id) or public.has_role(auth.uid(), 'system_admin'::app_role)) then
    raise exception 'only the school management can link history';
  end if;

  update public.student_history_records h
  set student_id = p.id
  from public.profiles p
  where h.school_id = p_school_id and h.student_id is null and h.student_key_hash is not null
    and p.school_id = p_school_id and p.id_number_hash = h.student_key_hash;
  get diagnostics v_n = row_count;

  update public.student_history_records h
  set student_id = m.id
  from (
    select p.id, btrim(p.full_name) as full_name
    from public.profiles p join public.user_roles ur on ur.user_id = p.id and ur.role = 'student'
    where p.school_id = p_school_id
    group by p.id, p.full_name
  ) m
  where h.school_id = p_school_id and h.student_id is null and h.student_key_hash is null
    and m.full_name = btrim(h.student_name)
    and (select count(*) from public.profiles p2 where p2.school_id = p_school_id and btrim(p2.full_name) = btrim(h.student_name)) = 1;
  get diagnostics v_m = row_count;

  return v_n + v_m;
end;
$$;
revoke execute on function public.link_student_history(uuid) from public, anon;
grant execute on function public.link_student_history(uuid) to authenticated;

-- ── Storage ──────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('school-imports', 'school-imports', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

drop policy if exists "Own folder upload school imports" on storage.objects;
create policy "Own folder upload school imports" on storage.objects
for insert to authenticated
with check (bucket_id = 'school-imports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder read school imports" on storage.objects;
create policy "Own folder read school imports" on storage.objects
for select to authenticated
using (
  bucket_id = 'school-imports'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'system_admin'::app_role)
    or exists (select 1 from public.school_imports i where i.file_path = storage.objects.name and public.is_school_manager(i.school_id))
  )
);

drop policy if exists "Own folder delete school imports" on storage.objects;
create policy "Own folder delete school imports" on storage.objects
for delete to authenticated
using (bucket_id = 'school-imports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder upload school logos" on storage.objects;
create policy "Own folder upload school logos" on storage.objects
for insert to authenticated
with check (bucket_id = 'school-logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Approve / reject ─────────────────────────────────────
create or replace function public.approve_school_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.school_applications;
  v_p jsonb;
  v_school uuid;
  v_grade text;
  v_n int;
  v_sub jsonb;
  v_item jsonb;
  v_grades text[];
  v_all_grades text[] := array['ז', 'ח', 'ט', 'י', 'יא', 'יב'];
  v_role text;
  i int := 0;
begin
  if not public.has_role(auth.uid(), 'system_admin'::app_role) then
    raise exception 'only a system admin can approve schools';
  end if;
  select * into v_app from public.school_applications where id = p_application_id for update;
  if v_app.id is null then raise exception 'application not found'; end if;
  if v_app.status <> 'pending' then raise exception 'application is %', v_app.status; end if;
  v_p := v_app.payload;

  insert into public.schools (name, city, institution_code, open_for_registration, approved_at)
  values (
    btrim(v_app.school_name),
    nullif(btrim(v_p #>> '{school,city}'), ''),
    nullif(btrim(v_p #>> '{school,institutionCode}'), ''),
    true,
    now()
  )
  returning id into v_school;

  -- Grades and classes
  select coalesce(array_agg(g), v_all_grades) into v_grades
  from jsonb_array_elements_text(coalesce(v_p #> '{school,grades}', '[]'::jsonb)) g
  where g = any (v_all_grades);
  foreach v_grade in array v_grades loop
    v_n := greatest(1, least(30, coalesce((v_p #>> array['school', 'classesPerGrade', v_grade])::int, 1)));
    for i in 1..v_n loop
      insert into public.classes (school_id, grade, class_number) values (v_school, v_grade::grade_level, i)
      on conflict do nothing;
    end loop;
  end loop;

  -- Subjects
  i := 0;
  for v_sub in select * from jsonb_array_elements(coalesce(v_p -> 'subjects', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.school_subjects (school_id, name, sticker_subject, logo_url, logo_mode, scope, grades, kind, options, sort_order)
    values (
      v_school,
      btrim(v_sub ->> 'name'),
      nullif(v_sub ->> 'sticker', ''),
      nullif(v_sub ->> 'logoUrl', ''),
      coalesce(nullif(v_sub ->> 'logoMode', ''), 'catalog'),
      coalesce(nullif(v_sub ->> 'scope', ''), 'school'),
      case coalesce(v_sub ->> 'scope', 'school')
        when 'school' then v_grades
        when 'middle' then array(select g from unnest(v_grades) g where g in ('ז', 'ח', 'ט'))
        when 'high' then array(select g from unnest(v_grades) g where g in ('י', 'יא', 'יב'))
        else array(select jsonb_array_elements_text(coalesce(v_sub -> 'grades', '[]'::jsonb)))
      end,
      coalesce(nullif(v_sub ->> 'kind', ''), 'regular'),
      jsonb_strip_nulls(jsonb_build_object('levels', v_sub -> 'levels', 'tracks', v_sub -> 'tracks')),
      i
    )
    on conflict (school_id, name) do nothing;
  end loop;

  -- Rooms
  for v_item in select * from jsonb_array_elements(coalesce(v_p -> 'rooms', '[]'::jsonb)) loop
    if coalesce(btrim(v_item ->> 'name'), '') <> '' then
      insert into public.school_rooms (school_id, name, kind, capacity)
      values (v_school, btrim(v_item ->> 'name'), nullif(v_item ->> 'kind', ''), nullif(v_item ->> 'capacity', '')::int)
      on conflict do nothing;
    end if;
  end loop;

  -- Teachers roster
  for v_item in select * from jsonb_array_elements(coalesce(v_p -> 'teachers', '[]'::jsonb)) loop
    if coalesce(btrim(v_item ->> 'fullName'), '') <> '' then
      insert into public.school_staff_roster (school_id, full_name, email, subjects, role)
      values (
        v_school, btrim(v_item ->> 'fullName'), nullif(lower(btrim(v_item ->> 'email')), ''),
        array(select jsonb_array_elements_text(coalesce(v_item -> 'subjects', '[]'::jsonb))),
        nullif(v_item ->> 'role', '')
      );
    end if;
  end loop;

  -- Custom roles
  for v_item in select * from jsonb_array_elements(coalesce(v_p #> '{roles,custom}', '[]'::jsonb)) loop
    if coalesce(btrim(v_item ->> 'name'), '') <> '' then
      insert into public.school_custom_roles (school_id, name, areas)
      values (v_school, btrim(v_item ->> 'name'), array(select jsonb_array_elements_text(coalesce(v_item -> 'areas', '[]'::jsonb))))
      on conflict do nothing;
    end if;
  end loop;

  -- Division principals have no built-in role of their own: they become
  -- custom roles with the management area, ready for the principal to assign.
  for v_role in select jsonb_array_elements_text(coalesce(v_p #> '{roles,builtin}', '[]'::jsonb)) loop
    if v_role in ('high_school_principal', 'middle_school_principal') then
      insert into public.school_custom_roles (school_id, name, areas)
      values (v_school, case v_role when 'high_school_principal' then 'מנהלת חטיבה עליונה' else 'מנהלת חטיבת ביניים' end, array['management'])
      on conflict do nothing;
    end if;
  end loop;

  -- Settings (the chat trigger fills chat_settings from the guidelines)
  insert into public.school_settings (school_id, guidelines, enabled_roles, timetable_constraints, grades, updated_by)
  values (
    v_school,
    coalesce(v_p -> 'guidelines', '{}'::jsonb),
    case when jsonb_typeof(v_p #> '{roles,builtin}') = 'array'
      then array(select jsonb_array_elements_text(v_p #> '{roles,builtin}'))
      else array['grade_coordinator', 'subject_coordinator', 'counselor', 'secretary', 'council_advisor', 'exam_coordinator'] end,
    coalesce(v_p -> 'constraints', '[]'::jsonb),
    v_grades,
    auth.uid()
  );

  -- Files uploaded with the application now belong to the school.
  update public.school_imports set school_id = v_school where application_id = p_application_id;

  -- The applicant becomes the school's principal.
  update public.profiles set school_id = v_school, is_approved = true where id = v_app.applicant_id;
  insert into public.user_roles (user_id, role) values (v_app.applicant_id, 'management') on conflict (user_id, role) do nothing;

  update public.school_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), school_id = v_school, updated_at = now()
  where id = p_application_id;

  return v_school;
end;
$$;
revoke execute on function public.approve_school_application(uuid) from public, anon;
grant execute on function public.approve_school_application(uuid) to authenticated;

create or replace function public.reject_school_application(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'system_admin'::app_role) then
    raise exception 'only a system admin can reject schools';
  end if;
  update public.school_applications
  set status = 'rejected', rejection_reason = nullif(btrim(p_reason), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_application_id and status = 'pending';
end;
$$;
revoke execute on function public.reject_school_application(uuid, text) from public, anon;
grant execute on function public.reject_school_application(uuid, text) to authenticated;

-- The staff roles and subjects a school uses, for its staff registration
-- form (before the registrant is a member and can read them).
create or replace function public.get_school_registration_info(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'roles', (select to_jsonb(enabled_roles) from public.school_settings where school_id = p_school_id),
    'subjects', (select coalesce(jsonb_agg(name order by sort_order, name), '[]'::jsonb) from public.school_subjects where school_id = p_school_id)
  )
$$;
grant execute on function public.get_school_registration_info(uuid) to anon, authenticated;
