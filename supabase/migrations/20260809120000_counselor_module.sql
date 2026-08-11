-- Counselor (יועץ/ת) module: secure case management + risk-signal read access.
-- Implements spec section "תצעויה" (Well-being Dashboard, Secure Case Management, Collaborative Intervention).

-- Case status per student, owned by a single counselor
CREATE TABLE public.counselor_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  student_id UUID NOT NULL,
  counselor_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'weekly_monitoring', 'active_care', 'remote_monitoring', 'referred_external', 'closed')),
  flagged_reason TEXT, -- e.g. 'ai_risk_flag', 'teacher_referral', 'self_referral', 'parent_referral'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counselor_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counselors manage own cases" ON public.counselor_cases
  FOR ALL TO authenticated
  USING (counselor_id = auth.uid())
  WITH CHECK (counselor_id = auth.uid());

-- Management/admin get oversight of case STATUS only (no note content - see counselor_notes below)
CREATE POLICY "Management can view case status" ON public.counselor_cases
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'system_admin')
  );

CREATE TRIGGER update_counselor_cases_updated_at
  BEFORE UPDATE ON public.counselor_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private session notes. Per spec: "even the system admin cannot read the content of
-- the conversations" — so intentionally NO management/admin SELECT policy exists here.
CREATE TABLE public.counselor_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.counselor_cases(id) ON DELETE CASCADE,
  counselor_id UUID NOT NULL,
  note_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counselor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counselors manage own notes" ON public.counselor_notes
  FOR ALL TO authenticated
  USING (counselor_id = auth.uid())
  WITH CHECK (counselor_id = auth.uid());

-- Guidance sent to a student's homeroom teacher WITHOUT exposing medical/session detail.
CREATE TABLE public.counselor_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.counselor_cases(id) ON DELETE CASCADE,
  counselor_id UUID NOT NULL,
  teacher_id UUID NOT NULL, -- recipient (typically the student's homeroom teacher)
  recommendation_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counselor_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counselors manage own recommendations" ON public.counselor_recommendations
  FOR ALL TO authenticated
  USING (counselor_id = auth.uid())
  WITH CHECK (counselor_id = auth.uid());

CREATE POLICY "Teachers can view recommendations addressed to them" ON public.counselor_recommendations
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Extend read access to existing pedagogical tables so the counselor can compute
-- risk signals (absences + focus + grade trend) without exposing write access.
CREATE POLICY "Counselors can view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));

CREATE POLICY "Counselors can view focus reports" ON public.focus_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));

CREATE POLICY "Counselors can view lesson notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));

CREATE POLICY "Counselors can view submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));

CREATE INDEX idx_counselor_cases_counselor ON public.counselor_cases(counselor_id);
CREATE INDEX idx_counselor_cases_student ON public.counselor_cases(student_id);
CREATE INDEX idx_counselor_notes_case ON public.counselor_notes(case_id);
CREATE INDEX idx_counselor_recommendations_teacher ON public.counselor_recommendations(teacher_id);
