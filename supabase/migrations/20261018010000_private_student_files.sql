-- Student submissions and absence-justification attachments (doctor's notes)
-- were uploaded to 'lesson-files', a PUBLIC bucket: anyone holding the URL
-- could download a student's work or medical note without signing in.
-- New uploads go to this private bucket under <kind>/<uploader_id>/<file>,
-- and the app stores "private-files:<path>" and signs a URL on open.
-- Teaching materials (presentations, exam archive) stay in 'lesson-files'.

insert into storage.buckets (id, name, public)
values ('private-files', 'private-files', false)
on conflict (id) do nothing;

-- Upload only into your own folder.
drop policy if exists "Users upload own private files" on storage.objects;
create policy "Users upload own private files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Read: the uploader, staff of the uploader's school, and the uploader's parents.
drop policy if exists "Owner, school staff and parents read private files" on storage.objects;
create policy "Owner, school staff and parents read private files"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-files'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or (
      (
        has_role(auth.uid(), 'educator') or has_role(auth.uid(), 'professional_teacher')
        or has_role(auth.uid(), 'subject_coordinator') or has_role(auth.uid(), 'grade_coordinator')
        or has_role(auth.uid(), 'counselor') or has_role(auth.uid(), 'management')
        or has_role(auth.uid(), 'system_admin')
      )
      and exists (
        select 1 from public.profiles owner
        where owner.id::text = (storage.foldername(name))[2]
          and owner.school_id = public.current_user_school_id()
      )
    )
    or exists (
      select 1 from public.parent_student ps
      where ps.parent_id = auth.uid() and ps.student_id::text = (storage.foldername(name))[2]
    )
  )
);

drop policy if exists "Users delete own private files" on storage.objects;
create policy "Users delete own private files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);
