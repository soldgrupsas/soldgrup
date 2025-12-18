-- Script de recuperación de equipos para la propuesta DS-BANAPLAST-5562025
-- Este script busca y restaura los equipos desde equipment_specs

-- Paso 1: Buscar la propuesta
DO $$
DECLARE
  proposal_uuid UUID;
  equipment_count INTEGER;
BEGIN
  -- Buscar la propuesta por offer_id (con y sin espacio)
  SELECT id INTO proposal_uuid
  FROM public.proposals
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1;

  IF proposal_uuid IS NULL THEN
    RAISE NOTICE 'No se encontró la propuesta DS-BANAPLAST-5562025';
    RETURN;
  END IF;

  RAISE NOTICE 'Propuesta encontrada: %', proposal_uuid;

  -- Paso 2: Ver equipos actuales en equipment_details
  SELECT COUNT(*) INTO equipment_count
  FROM public.equipment_details
  WHERE proposal_id = proposal_uuid;

  RAISE NOTICE 'Equipos actuales en equipment_details: %', equipment_count;

  -- Paso 3: Mostrar todos los equipment_details con equipment_specs
  RAISE NOTICE '=== EQUIPOS ENCONTRADOS EN EQUIPMENT_DETAILS ===';
  
  -- Paso 4: Restaurar equipment_id desde equipment_specs.id donde sea posible
  UPDATE public.equipment_details
  SET equipment_id = (equipment_specs->>'id')::uuid
  WHERE proposal_id = proposal_uuid
    AND equipment_specs IS NOT NULL
    AND equipment_specs->>'id' IS NOT NULL
    AND equipment_id IS NULL
    AND (equipment_specs->>'id')::uuid IN (
      SELECT id FROM public.equipment
    );

  GET DIAGNOSTICS equipment_count = ROW_COUNT;
  RAISE NOTICE 'Equipos restaurados con equipment_id: %', equipment_count;

  -- Paso 5: Mostrar resumen de equipos recuperables
  RAISE NOTICE '=== RESUMEN DE EQUIPOS ===';
  
END $$;

-- Consulta para ver todos los equipos de la propuesta
SELECT 
  ed.id,
  ed.equipment_name,
  ed.equipment_id,
  ed.equipment_specs->>'id' as equipment_specs_id,
  ed.equipment_specs->>'description' as description,
  ed.equipment_specs->>'name' as name_from_specs,
  ed.created_at,
  CASE 
    WHEN ed.equipment_id IS NOT NULL THEN 'Tiene equipment_id'
    WHEN ed.equipment_specs->>'id' IS NOT NULL THEN 'Tiene equipment_specs.id (recuperable)'
    ELSE 'Sin datos recuperables'
  END as estado
FROM public.equipment_details ed
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;






