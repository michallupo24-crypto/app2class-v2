-- National Bagrut archive: the Ministry of Education's past papers (2017-2026)
-- bulk-imported by scripts/import-bagrut.mjs. Unlike exam_archive (per-school
-- uploads), these papers are the same for every school, so rows are global and
-- read-only for app users; only the service-role import script writes them.
-- Each row is one paper (exam code + year + session), with its official sample
-- answer attached when one exists.

create extension if not exists pg_trgm;

create table public.bagrut_exams (
  id uuid primary key default gen_random_uuid(),
  exam_code text not null,
  subject text not null,
  sector text,               -- סוג חינוך: ממלכתי / ממלכתי-דתי
  units smallint,            -- יח"ל
  population text,           -- לעולים חדשים, אקסטרנים...
  description text,
  duration text,
  notes text,
  year smallint not null,
  session_key text not null, -- the zip folder name, e.g. 06_קיץ_מועד_א
  session_label text not null,
  session_order smallint not null,
  exam_file_url text not null,
  answer_file_url text,
  exam_text text,
  answer_text text,
  search_text text generated always as (
    coalesce(exam_code, '') || ' ' || coalesce(description, '') || ' ' ||
    coalesce(exam_text, '') || ' ' || coalesce(answer_text, '')
  ) stored,
  created_at timestamptz not null default now(),
  unique (exam_code, year, session_key)
);
alter table public.bagrut_exams enable row level security;

create policy "Authenticated can view bagrut archive" on public.bagrut_exams
  for select to authenticated using (true);

create index idx_bagrut_exams_subject_year on public.bagrut_exams(subject, year);
create index idx_bagrut_exams_search_trgm on public.bagrut_exams using gin (search_text gin_trgm_ops);

-- Content search returns only ids + a short snippet so the client never has to
-- download the full text of ~2,500 papers.
create or replace function public.search_bagrut_exams(p_query text)
returns table (id uuid, snippet text, in_answer boolean)
language sql stable
security invoker
set search_path = public
as $$
  select
    b.id,
    substring(t.body from greatest(strpos(lower(t.body), lower(p_query)) - 80, 1) for 220) as snippet,
    strpos(lower(coalesce(b.exam_text, '')), lower(p_query)) = 0
      and strpos(lower(coalesce(b.answer_text, '')), lower(p_query)) > 0 as in_answer
  from public.bagrut_exams b
  cross join lateral (select coalesce(b.exam_text, '') || ' ' || coalesce(b.answer_text, '') as body) t
  where length(trim(p_query)) >= 2
    and b.search_text ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  limit 1000;
$$;

grant execute on function public.search_bagrut_exams(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('bagrut-archive', 'bagrut-archive', true)
on conflict (id) do nothing;
