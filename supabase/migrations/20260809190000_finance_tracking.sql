-- Parent payments tracking. Deliberately a ledger, not a payment processor: staff record
-- payments collected offline (cash/bit/bank transfer), parents see what they owe/paid.
-- No money moves through the app itself.

CREATE TABLE public.payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade grade_level, -- NULL = applies to the whole school
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payment items" ON public.payment_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can manage payment items" ON public.payment_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER update_payment_items_updated_at
  BEFORE UPDATE ON public.payment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_item_id UUID NOT NULL REFERENCES public.payment_items(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
  paid_amount NUMERIC(10,2),
  payment_method TEXT CHECK (payment_method IN ('cash', 'bit', 'bank_transfer', 'other')),
  notes TEXT,
  marked_by UUID,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_item_id, student_id)
);
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can manage payment records" ON public.payment_records
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

-- Parents see only their own children's payment status (Privacy Wall, matches the
-- rest of the app's parent-data-isolation convention)
CREATE POLICY "Parents can view their children's payment records" ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student ps
      WHERE ps.parent_id = auth.uid() AND ps.student_id = payment_records.student_id
    )
  );

CREATE INDEX idx_payment_items_school_grade ON public.payment_items(school_id, grade);
CREATE INDEX idx_payment_records_item ON public.payment_records(payment_item_id);
CREATE INDEX idx_payment_records_student ON public.payment_records(student_id);
