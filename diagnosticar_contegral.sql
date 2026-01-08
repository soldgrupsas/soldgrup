-- PASO 1: Diagnosticar los informes de Contegral
-- Ver qué equipmentType tienen guardado

SELECT 
  id,
  company,
  data->>'equipmentType' as equipment_type,
  jsonb_array_length(data->'checklist') as total_checklist_items,
  CASE 
    WHEN data->'trolleyGroup' IS NOT NULL AND data->'trolleyGroup' != 'null'::jsonb 
    THEN 'SI' 
    ELSE 'NO' 
  END as tiene_trolley_group,
  CASE 
    WHEN data->'carrosTesteros' IS NOT NULL AND data->'carrosTesteros' != 'null'::jsonb 
    THEN 'SI' 
    ELSE 'NO' 
  END as tiene_carros_testeros,
  created_at
FROM maintenance_reports
WHERE company ILIKE '%contegral%'
ORDER BY created_at DESC;

-- PASO 2: SI los informes tienen equipmentType incorrecto, ejecutar esto para QUITARLO
-- Esto hará que el router los trate como informes legacy y use el MaintenanceReportWizard

/*
UPDATE maintenance_reports
SET data = data - 'equipmentType'
WHERE company ILIKE '%contegral%'
  AND data->>'equipmentType' IS NOT NULL;
*/

-- PASO 3: Verificar que se quitó el equipmentType
/*
SELECT 
  id,
  company,
  data->>'equipmentType' as equipment_type
FROM maintenance_reports
WHERE company ILIKE '%contegral%';
*/




