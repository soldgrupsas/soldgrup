-- Script para limpiar equipment_specs antiguos que contienen emojis o caracteres problemáticos
-- Esto fuerza a que todas las propuestas usen datos frescos de la tabla equipment

-- Paso 1: Limpiar equipment_specs de todos los equipment_details que tienen equipment_id
-- Esto asegura que siempre se carguen datos frescos desde la tabla equipment
UPDATE public.equipment_details
SET equipment_specs = NULL
WHERE equipment_id IS NOT NULL;

-- Paso 2: Para equipment_details sin equipment_id pero con equipment_specs,
-- intentar restaurar el equipment_id desde equipment_specs.id si existe
UPDATE public.equipment_details
SET equipment_id = (equipment_specs->>'id')::uuid
WHERE equipment_id IS NULL
  AND equipment_specs IS NOT NULL
  AND equipment_specs->>'id' IS NOT NULL
  AND (equipment_specs->>'id')::uuid IN (
    SELECT id FROM public.equipment
  );

-- Paso 3: Limpiar equipment_specs de los que ahora tienen equipment_id
UPDATE public.equipment_details
SET equipment_specs = NULL
WHERE equipment_id IS NOT NULL
  AND equipment_specs IS NOT NULL;

-- Paso 4: Mostrar resumen
SELECT 
  COUNT(*) as total_equipment_details,
  COUNT(equipment_id) as con_equipment_id,
  COUNT(CASE WHEN equipment_specs IS NOT NULL THEN 1 END) as con_equipment_specs_antiguos
FROM public.equipment_details;





