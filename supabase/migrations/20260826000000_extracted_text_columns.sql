-- Default client-side text extraction is being wired into exam archive
-- uploads, chat attachments, and teacher grading transcription (student
-- submissions already had a "content" field the existing manual extraction
-- button writes into - this is not that; these are net-new persisted spots).
alter table public.exam_archive add column if not exists extracted_text text;
alter table public.messages add column if not exists attachment_extracted_text text;
alter table public.submissions add column if not exists extracted_text text;
