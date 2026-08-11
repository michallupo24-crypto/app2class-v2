-- 1.3/1.4: the "allowed email domains" admin screen was local React state
-- only (reset on refresh, never enforced anywhere), and registration only
-- had a client-side autocomplete suggesting suffixes — nothing stopped an
-- arbitrary domain. This adds a real table the admin screen persists to,
-- and a trigger on auth.users that enforces it at the actual insert point
-- (so it can't be bypassed by calling supabase.auth.signUp directly,
-- regardless of which client screen triggers it).

create table public.allowed_email_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.allowed_email_domains enable row level security;

create policy "Anyone can view allowed domains" on public.allowed_email_domains
  for select using (true);

create policy "System admins manage allowed domains" on public.allowed_email_domains
  for all to authenticated
  using (has_role(auth.uid(), 'system_admin'::app_role))
  with check (has_role(auth.uid(), 'system_admin'::app_role));

insert into public.allowed_email_domains (domain) values
  ('gmail.com'), ('outlook.com'), ('taded.org.il'), ('demo.il')
on conflict (domain) do nothing;

create or replace function public.enforce_email_domain_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_allowed boolean;
begin
  v_domain := lower(split_part(NEW.email, '@', 2));

  select exists(
    select 1 from public.allowed_email_domains where lower(domain) = v_domain and is_active
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Email domain "%" is not on the allowed list', v_domain
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_email_domain_allowlist on auth.users;
create trigger trg_enforce_email_domain_allowlist
  before insert on auth.users
  for each row execute function public.enforce_email_domain_allowlist();
