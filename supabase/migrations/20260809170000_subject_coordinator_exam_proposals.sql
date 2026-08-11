-- Subject coordinators oversee their subject across every grade (no single grade
-- assigned to them), but grade_events RLS only ever let grade_coordinator/management/
-- system_admin write rows - subject_coordinator could never propose an exam date even
-- though the spec calls for it. Scope their write access to events in their own subject.

CREATE POLICY "Subject coordinators can propose exams in their subject"
ON public.grade_events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'subject_coordinator' AND ur.subject = grade_events.subject
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'subject_coordinator' AND ur.subject = grade_events.subject
  )
);
