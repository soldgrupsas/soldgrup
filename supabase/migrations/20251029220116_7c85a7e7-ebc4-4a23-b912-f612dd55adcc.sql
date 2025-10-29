-- Actualizar configuración del bucket 3d-models para especificar MIME types permitidos
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'model/gltf-binary',
    'model/gltf+json', 
    'application/octet-stream'
  ],
  file_size_limit = 52428800 -- 50MB en bytes
WHERE id = '3d-models';

-- Verificar que las políticas de acceso público están correctas
-- Esta consulta es solo informativa para verificar
DO $$
BEGIN
  RAISE NOTICE 'Bucket 3d-models actualizado. Recuerda configurar CORS manualmente en Supabase Dashboard.';
END $$;