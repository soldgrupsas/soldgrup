-- ============================================================
-- RESTAURAR INFORME DE ELEVADORES CORROMPIDO - COMPLETO
-- ============================================================
-- Este script restaura completamente un informe de elevadores
-- que fue incorrectamente convertido a puente grúa.
-- Restaura: equipmentType Y checklist con todos los datos
-- ============================================================

-- PASO 1: Ver el último informe y su estado actual
SELECT 
  id,
  company,
  technician_name,
  created_at,
  updated_at,
  (data->>'equipmentType') as equipment_type_actual,
  (data->'checklist'->0->>'name') as primer_item,
  jsonb_array_length(data->'checklist') as total_items
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 3;

-- PASO 2: Diagnóstico detallado del último informe
SELECT 
  id,
  (data->>'equipmentType') as equipment_type,
  (SELECT jsonb_agg(item->>'name') 
   FROM jsonb_array_elements(data->'checklist') item) as items_checklist
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================
-- PASO 3: RESTAURAR EL INFORME
-- ============================================================
-- Este UPDATE hace dos cosas:
-- 1. Cambia equipmentType de "puentes-grua" a "elevadores"
-- 2. Restaura los nombres del checklist al formato de elevadores
-- MANTENIENDO los status y observaciones de cada item
-- ============================================================

WITH ultimo_informe AS (
  SELECT id, data
  FROM maintenance_reports
  ORDER BY created_at DESC
  LIMIT 1
),
-- Mapeo de nombres: de Puente Grúa a Elevadores
nombres_elevadores AS (
  SELECT 
    idx,
    CASE idx
      WHEN 1 THEN 'Motor elevación'
      WHEN 2 THEN 'Freno elevación'
      WHEN 3 THEN 'Estructura'
      WHEN 4 THEN 'Gancho'
      WHEN 5 THEN 'Cadena'
      WHEN 6 THEN 'Guaya'
      WHEN 7 THEN 'Gabinete eléctrico'
      WHEN 8 THEN 'Guías laterales'
      WHEN 9 THEN 'Finales de carrera'
      WHEN 10 THEN 'Topes mecánicos'
      WHEN 11 THEN 'Aceite'
      WHEN 12 THEN 'Botoneras'
      WHEN 13 THEN 'Pines de seguridad'
      WHEN 14 THEN 'Cabina o canasta'
      WHEN 15 THEN 'Puertas'
    END as nombre
  FROM generate_series(1, 15) as idx
),
-- Reconstruir el checklist con nombres de elevadores
checklist_restaurado AS (
  SELECT ui.id, jsonb_agg(
    jsonb_build_object(
      'id', COALESCE(item->>'id', gen_random_uuid()::text),
      'name', ne.nombre,
      'status', item->>'status',
      'observation', COALESCE(item->>'observation', '')
    )
    ORDER BY ord
  ) as nuevo_checklist
  FROM ultimo_informe ui
  CROSS JOIN LATERAL jsonb_array_elements(ui.data->'checklist') WITH ORDINALITY AS arr(item, ord)
  JOIN nombres_elevadores ne ON ne.idx = arr.ord
  WHERE arr.ord <= 15
  GROUP BY ui.id
)
UPDATE maintenance_reports mr
SET data = jsonb_set(
  jsonb_set(
    mr.data,
    '{equipmentType}',
    '"elevadores"'
  ),
  '{checklist}',
  cr.nuevo_checklist
)
FROM checklist_restaurado cr
WHERE mr.id = cr.id;

-- ============================================================
-- PASO 4: VERIFICAR LA RESTAURACIÓN
-- ============================================================

SELECT 
  id,
  company,
  (data->>'equipmentType') as equipment_type_nuevo,
  (data->'checklist'->0->>'name') as item_1,
  (data->'checklist'->1->>'name') as item_2,
  (data->'checklist'->11->>'name') as item_12_botoneras,
  (data->'checklist'->13->>'name') as item_14_cabina,
  (data->'checklist'->14->>'name') as item_15_puertas,
  jsonb_array_length(data->'checklist') as total_items,
  CASE 
    WHEN (data->>'equipmentType') = 'elevadores' 
         AND (data->'checklist'->0->>'name') = 'Motor elevación'
    THEN '✅ RESTAURADO CORRECTAMENTE'
    ELSE '❌ VERIFICAR MANUALMENTE'
  END as estado
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 1;











