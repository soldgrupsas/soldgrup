-- Create equipment table
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create equipment images table
CREATE TABLE public.equipment_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create equipment tables (for custom data tables)
CREATE TABLE public.equipment_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  table_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  table_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment
CREATE POLICY "Authenticated users can manage equipment"
ON public.equipment
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- RLS Policies for equipment_images
CREATE POLICY "Authenticated users can manage equipment images"
ON public.equipment_images
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- RLS Policies for equipment_tables
CREATE POLICY "Authenticated users can manage equipment tables"
ON public.equipment_tables
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_equipment_images_equipment_id ON public.equipment_images(equipment_id);
CREATE INDEX idx_equipment_tables_equipment_id ON public.equipment_tables(equipment_id);