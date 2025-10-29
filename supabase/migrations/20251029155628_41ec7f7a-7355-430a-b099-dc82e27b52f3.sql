-- Create 3D models storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('3d-models', '3d-models', true);

-- RLS policies for 3D models bucket
CREATE POLICY "Authenticated users can upload 3D models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = '3d-models');

CREATE POLICY "Authenticated users can delete their 3D models"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = '3d-models');

CREATE POLICY "Public can view 3D models"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = '3d-models');

-- Add model_3d_url column to proposals table
ALTER TABLE proposals 
ADD COLUMN model_3d_url TEXT;