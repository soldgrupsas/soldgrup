-- Fix RLS policies for proposals and related tables
-- The issue is that auth.role() checks the JWT role, not authentication status
-- We need to check if user is authenticated with auth.uid() IS NOT NULL

-- Drop existing policies for proposals
DROP POLICY IF EXISTS "Authenticated users can manage proposals" ON public.proposals;
DROP POLICY IF EXISTS "Public can view published proposals" ON public.proposals;

-- Create corrected policies for proposals
CREATE POLICY "Authenticated users can manage proposals"
ON public.proposals
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view published proposals"
ON public.proposals
FOR SELECT
TO anon
USING (status = 'published' AND public_url_slug IS NOT NULL);

-- Fix proposal_items policies
DROP POLICY IF EXISTS "Authenticated users can manage proposal items" ON public.proposal_items;
DROP POLICY IF EXISTS "Public can view items of published proposals" ON public.proposal_items;

CREATE POLICY "Authenticated users can manage proposal items"
ON public.proposal_items
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view items of published proposals"
ON public.proposal_items
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = proposal_items.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix proposal_observations policies
DROP POLICY IF EXISTS "Authenticated users can manage observations" ON public.proposal_observations;
DROP POLICY IF EXISTS "Public can view observations of published proposals" ON public.proposal_observations;

CREATE POLICY "Authenticated users can manage observations"
ON public.proposal_observations
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view observations of published proposals"
ON public.proposal_observations
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = proposal_observations.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix technical_specifications policies
DROP POLICY IF EXISTS "Authenticated users can manage technical specs" ON public.technical_specifications;
DROP POLICY IF EXISTS "Public can view specs of published proposals" ON public.technical_specifications;

CREATE POLICY "Authenticated users can manage technical specs"
ON public.technical_specifications
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view specs of published proposals"
ON public.technical_specifications
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = technical_specifications.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix equipment_details policies
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment_details;
DROP POLICY IF EXISTS "Public can view equipment of published proposals" ON public.equipment_details;

CREATE POLICY "Authenticated users can manage equipment"
ON public.equipment_details
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view equipment of published proposals"
ON public.equipment_details
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = equipment_details.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix electrification_systems policies
DROP POLICY IF EXISTS "Authenticated users can manage electrification systems" ON public.electrification_systems;
DROP POLICY IF EXISTS "Public can view systems of published proposals" ON public.electrification_systems;

CREATE POLICY "Authenticated users can manage electrification systems"
ON public.electrification_systems
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view systems of published proposals"
ON public.electrification_systems
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = electrification_systems.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix proposal_images policies
DROP POLICY IF EXISTS "Authenticated users can manage images" ON public.proposal_images;
DROP POLICY IF EXISTS "Public can view images of published proposals" ON public.proposal_images;

CREATE POLICY "Authenticated users can manage images"
ON public.proposal_images
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view images of published proposals"
ON public.proposal_images
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = proposal_images.proposal_id
    AND proposals.status = 'published'
    AND proposals.public_url_slug IS NOT NULL
));

-- Fix proposal_clicks policies
DROP POLICY IF EXISTS "Authenticated users can view all clicks" ON public.proposal_clicks;
DROP POLICY IF EXISTS "Anyone can insert click tracking" ON public.proposal_clicks;

CREATE POLICY "Authenticated users can view all clicks"
ON public.proposal_clicks
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can insert click tracking"
ON public.proposal_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);