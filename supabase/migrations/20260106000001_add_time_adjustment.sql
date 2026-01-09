-- Add time adjustment field to attendance_records
-- This field stores minutes adjustment for lunch breaks or other anomalies
-- Positive values = extra minutes worked (e.g., didn't take full lunch)
-- Negative values = minutes not worked (e.g., took extended break)

ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS time_adjustment_minutes integer DEFAULT 0;

ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS adjustment_note text;

COMMENT ON COLUMN public.attendance_records.time_adjustment_minutes IS 'Minutes adjustment: positive = extra worked, negative = not worked';
COMMENT ON COLUMN public.attendance_records.adjustment_note IS 'Note explaining the time adjustment';





