-- Real exam/bagrut archive - actual uploaded past papers, organized by subject/year/topic.
-- Distinct from "Bagrut Hunter" (which asks the AI to invent practice questions in the
-- same style): this is a genuine document repository teachers and coordinators populate,
-- matching the spec's "Exam & Bagrut Archive" feature, which had zero backing until now.

CREATE TABLE public.exam_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade grade_level,
  year SMALLINT,
  title TEXT NOT NULL,
  topic TEXT,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exam archive" ON public.exam_archive
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teaching staff can upload to exam archive" ON public.exam_archive
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      has_role(auth.uid(), 'professional_teacher') OR
      has_role(auth.uid(), 'subject_coordinator') OR
      has_role(auth.uid(), 'grade_coordinator') OR
      has_role(auth.uid(), 'management') OR
      has_role(auth.uid(), 'system_admin')
    )
  );

CREATE POLICY "Uploaders and admin can delete archive entries" ON public.exam_archive
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE INDEX idx_exam_archive_school_subject ON public.exam_archive(school_id, subject);
