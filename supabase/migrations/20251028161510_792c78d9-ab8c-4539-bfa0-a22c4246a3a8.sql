-- Create proposals table
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_contact TEXT,
  client_email TEXT,
  client_phone TEXT,
  project_name TEXT NOT NULL,
  project_location TEXT,
  engineer_name TEXT,
  engineer_title TEXT,
  proposal_date DATE DEFAULT CURRENT_DATE,
  validity_days INTEGER DEFAULT 30,
  total_amount DECIMAL(12,2),
  status TEXT DEFAULT 'draft',
  notes TEXT,
  terms_conditions TEXT,
  payment_terms TEXT,
  delivery_time TEXT,
  public_url_slug TEXT UNIQUE,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create proposal_items table
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create proposal_observations table
CREATE TABLE IF NOT EXISTS public.proposal_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  observation_text TEXT NOT NULL,
  observation_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create technical_specifications table
CREATE TABLE IF NOT EXISTS public.technical_specifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  specification_type TEXT NOT NULL,
  specification_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create equipment_details table
CREATE TABLE IF NOT EXISTS public.equipment_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  equipment_specs JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create electrification_systems table
CREATE TABLE IF NOT EXISTS public.electrification_systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,
  system_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create proposal_images table
CREATE TABLE IF NOT EXISTS public.proposal_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_caption TEXT,
  image_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create proposal_clicks tracking table
CREATE TABLE IF NOT EXISTS public.proposal_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create storage bucket for proposal images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proposal-images', 'proposal-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electrification_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proposals (admin can do everything, public can read published)
CREATE POLICY "Authenticated users can manage proposals"
  ON public.proposals FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view published proposals"
  ON public.proposals FOR SELECT
  USING (status = 'published' AND public_url_slug IS NOT NULL);

-- RLS Policies for proposal_items
CREATE POLICY "Authenticated users can manage proposal items"
  ON public.proposal_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view items of published proposals"
  ON public.proposal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_items.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

-- RLS Policies for proposal_observations
CREATE POLICY "Authenticated users can manage observations"
  ON public.proposal_observations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view observations of published proposals"
  ON public.proposal_observations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_observations.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

-- Similar policies for other related tables
CREATE POLICY "Authenticated users can manage technical specs"
  ON public.technical_specifications FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view specs of published proposals"
  ON public.technical_specifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = technical_specifications.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment_details FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view equipment of published proposals"
  ON public.equipment_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = equipment_details.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can manage electrification systems"
  ON public.electrification_systems FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view systems of published proposals"
  ON public.electrification_systems FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = electrification_systems.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can manage images"
  ON public.proposal_images FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public can view images of published proposals"
  ON public.proposal_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_images.proposal_id
      AND proposals.status = 'published'
      AND proposals.public_url_slug IS NOT NULL
    )
  );

CREATE POLICY "Anyone can insert click tracking"
  ON public.proposal_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all clicks"
  ON public.proposal_clicks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Storage policies
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proposal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'proposal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'proposal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proposal-images');

-- Function to increment proposal clicks
CREATE OR REPLACE FUNCTION increment_proposal_clicks(proposal_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.proposals
  SET click_count = click_count + 1
  WHERE public_url_slug = proposal_slug;
END;
$$;

-- Function to generate unique proposal slug
CREATE OR REPLACE FUNCTION generate_proposal_slug()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_observations_proposal_id ON public.proposal_observations(proposal_id);
CREATE INDEX IF NOT EXISTS idx_technical_specs_proposal_id ON public.technical_specifications(proposal_id);
CREATE INDEX IF NOT EXISTS idx_equipment_details_proposal_id ON public.equipment_details(proposal_id);
CREATE INDEX IF NOT EXISTS idx_electrification_systems_proposal_id ON public.electrification_systems(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_images_proposal_id ON public.proposal_images(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_clicks_proposal_id ON public.proposal_clicks(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_public_url_slug ON public.proposals(public_url_slug);

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();