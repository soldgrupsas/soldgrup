-- Corregir políticas RLS para rol 'mantenimiento'
-- Los usuarios con rol 'mantenimiento' NO deben tener acceso a proposals y equipment
-- Solo deben tener acceso a maintenance-reports
--
-- Esta migración corrige las políticas establecidas en 20251101120000_add_mantenimiento_role.sql
-- que incorrectamente daban acceso a proposals y equipment a usuarios con rol 'mantenimiento'

-- ============================================
-- 1. CORREGIR POLÍTICAS DE PROPOSALS
-- ============================================
-- Remover acceso de 'mantenimiento' a proposals y tablas relacionadas

-- Proposals
DROP POLICY IF EXISTS "Authenticated users can manage proposals" ON public.proposals;
CREATE POLICY "Authenticated users can manage proposals"
  ON public.proposals
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal items
DROP POLICY IF EXISTS "Authenticated users can manage proposal items" ON public.proposal_items;
CREATE POLICY "Authenticated users can manage proposal items"
  ON public.proposal_items
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal observations
DROP POLICY IF EXISTS "Authenticated users can manage observations" ON public.proposal_observations;
CREATE POLICY "Authenticated users can manage observations"
  ON public.proposal_observations
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Technical specifications
DROP POLICY IF EXISTS "Authenticated users can manage technical specs" ON public.technical_specifications;
CREATE POLICY "Authenticated users can manage technical specs"
  ON public.technical_specifications
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Equipment details (en proposals)
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment_details;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Electrification systems
DROP POLICY IF EXISTS "Authenticated users can manage electrification systems" ON public.electrification_systems;
CREATE POLICY "Authenticated users can manage electrification systems"
  ON public.electrification_systems
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal images
DROP POLICY IF EXISTS "Authenticated users can manage images" ON public.proposal_images;
CREATE POLICY "Authenticated users can manage images"
  ON public.proposal_images
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal clicks
DROP POLICY IF EXISTS "Authenticated users can view all clicks" ON public.proposal_clicks;
CREATE POLICY "Authenticated users can view all clicks"
  ON public.proposal_clicks
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- ============================================
-- 2. CORREGIR POLÍTICAS DE EQUIPMENT
-- ============================================
-- Remover acceso de 'mantenimiento' a equipment y tablas relacionadas

-- Equipment
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- Equipment images
DROP POLICY IF EXISTS "Authenticated users can manage equipment images" ON public.equipment_images;
CREATE POLICY "Authenticated users can manage equipment images"
  ON public.equipment_images
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- Equipment tables
DROP POLICY IF EXISTS "Authenticated users can manage equipment tables" ON public.equipment_tables;
CREATE POLICY "Authenticated users can manage equipment tables"
  ON public.equipment_tables
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- ============================================
-- 3. ACTUALIZAR POLÍTICAS DE MAINTENANCE REPORTS
-- ============================================
-- Agregar acceso de 'mantenimiento' a maintenance_reports

-- Maintenance reports
DROP POLICY IF EXISTS "Authenticated users manage maintenance reports" ON public.maintenance_reports;
CREATE POLICY "Authenticated users manage maintenance reports"
  ON public.maintenance_reports
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  );

-- Maintenance report photos
DROP POLICY IF EXISTS "Authenticated users manage maintenance report photos" ON public.maintenance_report_photos;
CREATE POLICY "Authenticated users manage maintenance report photos"
  ON public.maintenance_report_photos
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  );

-- ============================================
-- 4. ACTUALIZAR POLÍTICAS DE STORAGE PARA MAINTENANCE REPORTS
-- ============================================
-- Agregar acceso de 'mantenimiento' a storage de maintenance reports

-- Upload maintenance report photos
DROP POLICY IF EXISTS "Authenticated users upload maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users upload maintenance report photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );

-- Update maintenance report photos
DROP POLICY IF EXISTS "Authenticated users update maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users update maintenance report photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );

-- Delete maintenance report photos
DROP POLICY IF EXISTS "Authenticated users delete maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users delete maintenance report photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );



























