-- Actualizar políticas RLS para eliminar la verificación de status='published'
-- Solo verificaremos que public_url_slug IS NOT NULL

-- 1. Actualizar política de proposals
DROP POLICY IF EXISTS "Public can view published proposals" ON public.proposals;
CREATE POLICY "Public can view proposals with slug" 
  ON public.proposals 
  FOR SELECT 
  TO anon 
  USING (public_url_slug IS NOT NULL);

-- 2. Actualizar política de proposal_items
DROP POLICY IF EXISTS "Public can view items of published proposals" ON public.proposal_items;
CREATE POLICY "Public can view items with slug" 
  ON public.proposal_items 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = proposal_items.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );

-- 3. Actualizar política de proposal_images
DROP POLICY IF EXISTS "Public can view images of published proposals" ON public.proposal_images;
CREATE POLICY "Public can view images with slug" 
  ON public.proposal_images 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = proposal_images.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );

-- 4. Actualizar política de equipment_details
DROP POLICY IF EXISTS "Public can view equipment of published proposals" ON public.equipment_details;
CREATE POLICY "Public can view equipment with slug" 
  ON public.equipment_details 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = equipment_details.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );

-- 5. Actualizar política de technical_specifications
DROP POLICY IF EXISTS "Public can view specs of published proposals" ON public.technical_specifications;
CREATE POLICY "Public can view specs with slug" 
  ON public.technical_specifications 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = technical_specifications.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );

-- 6. Actualizar política de electrification_systems
DROP POLICY IF EXISTS "Public can view systems of published proposals" ON public.electrification_systems;
CREATE POLICY "Public can view systems with slug" 
  ON public.electrification_systems 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = electrification_systems.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );

-- 7. Actualizar política de proposal_observations
DROP POLICY IF EXISTS "Public can view observations of published proposals" ON public.proposal_observations;
CREATE POLICY "Public can view observations with slug" 
  ON public.proposal_observations 
  FOR SELECT 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals 
      WHERE proposals.id = proposal_observations.proposal_id 
        AND proposals.public_url_slug IS NOT NULL
    )
  );