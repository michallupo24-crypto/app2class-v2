-- Support & Help Center: FAQ knowledge base + ticketing, per spec's "Help Center" section
-- ("Floating Support Button", "Knowledge Base & Wiki", "Ticketing System"). Entirely missing
-- until now - no FAQ, no bug/help reporting flow existed anywhere in the app.

CREATE TABLE public.faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL = global, applies to every school
  category TEXT NOT NULL DEFAULT 'general',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index SMALLINT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view faq items" ON public.faq_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can manage faq items" ON public.faq_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('bug', 'question', 'account', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Management can view and resolve all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_school_status ON public.support_tickets(school_id, status);
CREATE INDEX idx_faq_items_school ON public.faq_items(school_id);

-- Seed a small starter FAQ so the page isn't empty on first load
INSERT INTO public.faq_items (category, question, answer, order_index, created_by) VALUES
  ('registration', 'שכחתי סיסמה, מה עושים?', 'פנה/י למנהל/ת המערכת בבית הספר - רק הם יכולים לאפס סיסמה של משתמש.', 1, '00000000-0000-0000-0000-000000000000'),
  ('registration', 'כמה זמן לוקח לאשר הרשמה?', 'הרשמת תלמיד/הורה ממתינה לאישור המחנך/ת של הכיתה, ולרוב מאושרת תוך יום-יומיים.', 2, '00000000-0000-0000-0000-000000000000'),
  ('general', 'איך משנים את האווטאר שלי?', 'לחצו על תמונת הפרופיל בראש התפריט הצדדי כדי לפתוח את סטודיו האווטאר.', 3, '00000000-0000-0000-0000-000000000000'),
  ('general', 'איך מדווחים על באג או תקלה?', 'לחצו על "פתח פנייה" בעמוד התמיכה, בחרו קטגוריית "באג" ותארו מה קרה.', 4, '00000000-0000-0000-0000-000000000000');
