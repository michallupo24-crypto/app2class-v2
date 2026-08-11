-- Real audit trail (the admin page's "Audit Trail" tab was reading the approvals
-- table as a stand-in - it never recorded blocks, password resets, or school creation)
-- and school-wide/platform-wide announcements (the principal's "broadcast" button
-- inserted into grade_announcements with columns that don't exist on that table -
-- author_id/status instead of created_by/published - so it silently failed).

CREATE TABLE public.system_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'user_blocked' | 'user_unblocked' | 'password_reset' | 'school_created' | 'roles_updated' | ...
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log own actions" ON public.system_audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Management can view audit log" ON public.system_audit_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'system_admin') OR
    (has_role(auth.uid(), 'management') AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()))
  );

CREATE INDEX idx_system_audit_log_created ON public.system_audit_log(created_at DESC);
CREATE INDEX idx_system_audit_log_school ON public.system_audit_log(school_id);

CREATE TABLE public.system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id), -- NULL = platform-wide (system_admin only)
  title TEXT NOT NULL DEFAULT 'הודעת הנהלה',
  content TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'emergency')),
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view announcements" ON public.system_announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Management can create school announcements" ON public.system_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'management') AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())) OR
    has_role(auth.uid(), 'system_admin')
  );

CREATE POLICY "Creators and admin can manage announcements" ON public.system_announcements
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'system_admin'));

CREATE INDEX idx_system_announcements_school ON public.system_announcements(school_id);
