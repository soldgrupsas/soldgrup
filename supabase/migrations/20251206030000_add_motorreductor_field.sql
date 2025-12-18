-- Add dedicated JSONB column for motorreductor
-- This column will be populated from the 'data' field for easier access
-- while maintaining backward compatibility

ALTER TABLE public.maintenance_reports
ADD COLUMN IF NOT EXISTS motorreductor jsonb;

-- Create index for faster queries on this field
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_motorreductor ON public.maintenance_reports USING gin (motorreductor);

-- Function to sync data from 'data' field to dedicated column
CREATE OR REPLACE FUNCTION sync_maintenance_report_motorreductor()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync motorreductor from data field
  IF NEW.data->>'motorreductor' IS NOT NULL THEN
    NEW.motorreductor := NEW.data->'motorreductor';
  ELSIF NEW.data->'data'->>'motorreductor' IS NOT NULL THEN
    NEW.motorreductor := NEW.data->'data'->'motorreductor';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the existing trigger to also sync motorreductor
CREATE OR REPLACE FUNCTION sync_maintenance_report_special_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync trolleyGroup from data field
  IF NEW.data->>'trolleyGroup' IS NOT NULL THEN
    NEW.trolley_group := NEW.data->'trolleyGroup';
  ELSIF NEW.data->'data'->>'trolleyGroup' IS NOT NULL THEN
    NEW.trolley_group := NEW.data->'data'->'trolleyGroup';
  END IF;
  
  -- Sync carrosTesteros from data field
  IF NEW.data->>'carrosTesteros' IS NOT NULL THEN
    NEW.carros_testeros := NEW.data->'carrosTesteros';
  ELSIF NEW.data->'data'->>'carrosTesteros' IS NOT NULL THEN
    NEW.carros_testeros := NEW.data->'data'->'carrosTesteros';
  END IF;
  
  -- Sync motorreductor from data field (igual que carrosTesteros)
  IF NEW.data->>'motorreductor' IS NOT NULL THEN
    NEW.motorreductor := NEW.data->'motorreductor';
  ELSIF NEW.data->'data'->>'motorreductor' IS NOT NULL THEN
    NEW.motorreductor := NEW.data->'data'->'motorreductor';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asegurar que el trigger esté activo (aunque ya existe, esto garantiza que esté configurado)
DROP TRIGGER IF EXISTS trg_sync_maintenance_report_special_fields ON public.maintenance_reports;
CREATE TRIGGER trg_sync_maintenance_report_special_fields
  BEFORE INSERT OR UPDATE ON public.maintenance_reports
  FOR EACH ROW
  EXECUTE FUNCTION sync_maintenance_report_special_fields();

-- Backfill existing records
UPDATE public.maintenance_reports
SET 
  motorreductor = CASE 
    WHEN data->>'motorreductor' IS NOT NULL THEN data->'motorreductor'
    WHEN data->'data'->>'motorreductor' IS NOT NULL THEN data->'data'->'motorreductor'
    ELSE NULL
  END
WHERE motorreductor IS NULL;

-- Forzar sincronización de motorreductor para registros existentes que tengan data.motorreductor
-- Esto asegura que incluso si el trigger no funcionó, los datos estén sincronizados
UPDATE public.maintenance_reports
SET 
  motorreductor = data->'motorreductor'
WHERE data->>'motorreductor' IS NOT NULL 
  AND (motorreductor IS NULL OR motorreductor != data->'motorreductor');


