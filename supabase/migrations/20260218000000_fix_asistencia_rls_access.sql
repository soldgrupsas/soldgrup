-- Fix RLS policies for time-control tables to allow the asistencia user.
-- The asistencia@soldgrup.com user has no role in user_roles, so the original
-- RLS policies (which only check admin/user roles) block all data access.

-- Helper: check if the current user is the asistencia account
CREATE OR REPLACE FUNCTION public.is_asistencia_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = 'asistencia@soldgrup.com';
$$;

-- ============================================
-- 1. WORKERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage workers" ON public.workers;

-- Asistencia can only SELECT workers (for the dropdown)
CREATE POLICY "Asistencia users can view workers"
  ON public.workers
  FOR SELECT
  USING (public.is_asistencia_user());

-- Admin/User can do everything with workers
CREATE POLICY "Admin and user roles can manage workers"
  ON public.workers
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  );

-- ============================================
-- 2. ATTENDANCE_RECORDS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage attendance records" ON public.attendance_records;

-- Asistencia can read and insert/update attendance records (clock in/out)
CREATE POLICY "Asistencia users can manage attendance records"
  ON public.attendance_records
  FOR ALL
  USING (public.is_asistencia_user())
  WITH CHECK (public.is_asistencia_user());

-- Admin/User keep full access
CREATE POLICY "Admin and user roles can manage attendance records"
  ON public.attendance_records
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  );

-- ============================================
-- 3. STORAGE: ATTENDANCE PHOTOS
-- ============================================
-- Allow asistencia to upload attendance photos
DROP POLICY IF EXISTS "Authenticated users upload attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users upload attendance photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR public.is_asistencia_user()
    )
  );

-- Allow asistencia to update attendance photos
DROP POLICY IF EXISTS "Authenticated users update attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users update attendance photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR public.is_asistencia_user()
    )
  );

-- Allow asistencia to delete attendance photos
DROP POLICY IF EXISTS "Authenticated users delete attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users delete attendance photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR public.is_asistencia_user()
    )
  );
