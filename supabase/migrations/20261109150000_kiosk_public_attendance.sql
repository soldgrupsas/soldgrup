-- Pantalla pública de entrada/salida.
-- El anon solo ve nombres de trabajadores y puede leer o marcar la asistencia de HOY.
-- No puede ver cédula, sueldo, historial ni borrar registros.

CREATE OR REPLACE FUNCTION public.kiosk_list_workers()
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.first_name, w.last_name
  FROM public.workers w
  ORDER BY w.first_name, w.last_name;
$$;

REVOKE ALL ON FUNCTION public.kiosk_list_workers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_list_workers() TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.attendance_records TO anon;

DROP POLICY IF EXISTS "Kiosk anon reads today attendance" ON public.attendance_records;
CREATE POLICY "Kiosk anon reads today attendance"
  ON public.attendance_records
  FOR SELECT
  TO anon
  USING (date = (timezone('America/Bogota', now()))::date);

DROP POLICY IF EXISTS "Kiosk anon inserts today attendance" ON public.attendance_records;
CREATE POLICY "Kiosk anon inserts today attendance"
  ON public.attendance_records
  FOR INSERT
  TO anon
  WITH CHECK (date = (timezone('America/Bogota', now()))::date);

DROP POLICY IF EXISTS "Kiosk anon updates today attendance" ON public.attendance_records;
CREATE POLICY "Kiosk anon updates today attendance"
  ON public.attendance_records
  FOR UPDATE
  TO anon
  USING (date = (timezone('America/Bogota', now()))::date)
  WITH CHECK (date = (timezone('America/Bogota', now()))::date);

DROP POLICY IF EXISTS "Kiosk anon uploads attendance photos" ON storage.objects;
CREATE POLICY "Kiosk anon uploads attendance photos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Kiosk anon updates attendance photos" ON storage.objects;
CREATE POLICY "Kiosk anon updates attendance photos"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'attendance-photos');
