-- Función para recuperar equipos desde equipment_specs para una propuesta específica
-- Uso: SELECT recover_equipment_from_specs('DS-BANAPLAST-5562025');

CREATE OR REPLACE FUNCTION recover_equipment_from_specs(proposal_offer_id TEXT)
RETURNS TABLE(
  equipment_detail_id UUID,
  equipment_name TEXT,
  equipment_id_restored UUID,
  status TEXT,
  equipment_specs_data JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal_uuid UUID;
  recovered_count INTEGER := 0;
BEGIN
  -- Buscar la propuesta
  SELECT id INTO proposal_uuid
  FROM public.proposals
  WHERE offer_id = proposal_offer_id 
     OR offer_id = REPLACE(proposal_offer_id, '-', '- ')
  LIMIT 1;

  IF proposal_uuid IS NULL THEN
    RAISE EXCEPTION 'No se encontró la propuesta con offer_id: %', proposal_offer_id;
  END IF;

  -- Restaurar equipment_id desde equipment_specs donde sea posible
  UPDATE public.equipment_details
  SET equipment_id = (equipment_specs->>'id')::uuid
  WHERE proposal_id = proposal_uuid
    AND equipment_specs IS NOT NULL
    AND equipment_specs->>'id' IS NOT NULL
    AND equipment_id IS NULL
    AND (equipment_specs->>'id')::uuid IN (
      SELECT id FROM public.equipment
    );

  GET DIAGNOSTICS recovered_count = ROW_COUNT;

  -- Devolver todos los equipos de la propuesta
  RETURN QUERY
  SELECT 
    ed.id as equipment_detail_id,
    ed.equipment_name,
    ed.equipment_id as equipment_id_restored,
    CASE 
      WHEN ed.equipment_id IS NOT NULL THEN 'Restaurado con equipment_id'
      WHEN ed.equipment_specs->>'id' IS NOT NULL THEN 'Tiene datos en equipment_specs (equipo puede no existir)'
      ELSE 'Sin datos recuperables'
    END as status,
    ed.equipment_specs as equipment_specs_data
  FROM public.equipment_details ed
  WHERE ed.proposal_id = proposal_uuid
  ORDER BY ed.created_at;

  RAISE NOTICE 'Equipos restaurados: %', recovered_count;
END;
$$;

-- Ejecutar recuperación para la propuesta específica
SELECT * FROM recover_equipment_from_specs('DS-BANAPLAST-5562025');






