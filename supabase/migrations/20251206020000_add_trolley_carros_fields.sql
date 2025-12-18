-- Add dedicated JSONB columns for trolleyGroup and carrosTesteros
-- These columns will be populated from the 'data' field for easier access
-- while maintaining backward compatibility

ALTER TABLE public.maintenance_reports
ADD COLUMN IF NOT EXISTS trolley_group jsonb,
ADD COLUMN IF NOT EXISTS carros_testeros jsonb;

-- Create indexes for faster queries on these fields
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_trolley_group ON public.maintenance_reports USING gin (trolley_group);
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_carros_testeros ON public.maintenance_reports USING gin (carros_testeros);

-- Function to sync data from 'data' field to dedicated columns
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically sync fields on insert/update
DROP TRIGGER IF EXISTS trg_sync_maintenance_report_special_fields ON public.maintenance_reports;
CREATE TRIGGER trg_sync_maintenance_report_special_fields
  BEFORE INSERT OR UPDATE ON public.maintenance_reports
  FOR EACH ROW
  EXECUTE FUNCTION sync_maintenance_report_special_fields();

-- Backfill existing records
UPDATE public.maintenance_reports
SET 
  trolley_group = CASE 
    WHEN data->>'trolleyGroup' IS NOT NULL THEN data->'trolleyGroup'
    WHEN data->'data'->>'trolleyGroup' IS NOT NULL THEN data->'data'->'trolleyGroup'
    ELSE NULL
  END,
  carros_testeros = CASE 
    WHEN data->>'carrosTesteros' IS NOT NULL THEN data->'carrosTesteros'
    WHEN data->'data'->>'carrosTesteros' IS NOT NULL THEN data->'data'->'carrosTesteros'
    ELSE NULL
  END
WHERE trolley_group IS NULL AND carros_testeros IS NULL;

