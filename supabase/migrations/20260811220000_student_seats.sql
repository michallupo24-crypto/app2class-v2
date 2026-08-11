-- SeatingMapPage / useSmartSeat implement the spec's "class avatar seating map"
-- (homeroom teacher + counselor collaboratively arrange the classroom) but the
-- table they read/write, student_seats, was never created — confirmed missing
-- via direct REST query against the live project. Mirrors the attendance table's
-- RLS shape (20260210235759): staff manage, students see only their own seat.

CREATE TABLE public.student_seats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

ALTER TABLE public.student_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage seats" ON public.student_seats
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'system_admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'educator') OR
    public.has_role(auth.uid(), 'grade_coordinator') OR
    public.has_role(auth.uid(), 'counselor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'system_admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'educator') OR
    public.has_role(auth.uid(), 'grade_coordinator') OR
    public.has_role(auth.uid(), 'counselor')
  );

CREATE POLICY "Students can view own seat" ON public.student_seats
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER update_student_seats_updated_at BEFORE UPDATE ON public.student_seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
