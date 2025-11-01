-- Add nuevo rol de mantenimiento y actualizar políticas relacionadas
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mantenimiento';

-- Actualizar políticas para proposals y tablas relacionadas
DROP POLICY IF EXISTS "Authenticated users can manage proposals" ON public.proposals;
CREATE POLICY "Authenticated users can manage proposals"
  ON public.proposals
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage proposal items" ON public.proposal_items;
CREATE POLICY "Authenticated users can manage proposal items"
  ON public.proposal_items
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage observations" ON public.proposal_observations;
CREATE POLICY "Authenticated users can manage observations"
  ON public.proposal_observations
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage technical specs" ON public.technical_specifications;
CREATE POLICY "Authenticated users can manage technical specs"
  ON public.technical_specifications
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment_details;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage electrification systems" ON public.electrification_systems;
CREATE POLICY "Authenticated users can manage electrification systems"
  ON public.electrification_systems
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can manage images" ON public.proposal_images;
CREATE POLICY "Authenticated users can manage images"
  ON public.proposal_images
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

DROP POLICY IF EXISTS "Authenticated users can view all clicks" ON public.proposal_clicks;
CREATE POLICY "Authenticated users can view all clicks"
  ON public.proposal_clicks
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user') OR
    public.has_role(auth.uid(), 'mantenimiento')
  );

-- Actualizar políticas para tablas de equipos
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment
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

DROP POLICY IF EXISTS "Authenticated users can manage equipment images" ON public.equipment_images;
CREATE POLICY "Authenticated users can manage equipment images"
  ON public.equipment_images
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

DROP POLICY IF EXISTS "Authenticated users can manage equipment tables" ON public.equipment_tables;
CREATE POLICY "Authenticated users can manage equipment tables"
  ON public.equipment_tables
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
