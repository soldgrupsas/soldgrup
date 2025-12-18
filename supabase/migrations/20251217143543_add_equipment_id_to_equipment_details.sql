-- Add equipment_id column to equipment_details table
-- This allows proposals to reference equipment dynamically instead of copying data

ALTER TABLE public.equipment_details
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_equipment_details_equipment_id ON public.equipment_details(equipment_id);

-- Backfill existing records: extract equipment_id from equipment_specs JSONB
-- This maintains compatibility with existing data
UPDATE public.equipment_details
SET equipment_id = (equipment_specs->>'id')::uuid
WHERE equipment_specs->>'id' IS NOT NULL
  AND equipment_id IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.equipment_details.equipment_id IS 'Reference to the equipment table. When set, equipment data is loaded dynamically from the equipment table instead of using the stored copy in equipment_specs.';






