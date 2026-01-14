-- ============================================================
-- SCRIPT PARA RESTAURAR INFORME DE ELEVADORES CORROMPIDO
-- ============================================================
-- Este script restaura el checklist de un informe de elevadores
-- que fue incorrectamente convertido a formato de puente grúa.
-- ============================================================

-- PASO 1: Ver el último informe y su tipo
SELECT 
  id,
  company,
  technician_name,
  created_at,
  updated_at,
  (data->>'equipmentType') as equipment_type,
  jsonb_array_length(data->'checklist') as total_checklist_items,
  -- Ver primer item del checklist para identificar formato
  (data->'checklist'->0->>'name') as primer_item_checklist
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 5;

-- PASO 2: Identificar informes de elevadores con checklist de puente grúa (CORROMPIDOS)
-- Los informes de elevadores deben tener items como "Motor elevación" (sin "de")
-- Si tienen "Motor de elevación" (con "de"), están corrompidos
SELECT 
  id,
  company,
  created_at,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as primer_item,
  CASE 
    WHEN (data->>'equipmentType') = 'elevadores' 
         AND (data->'checklist'->0->>'name') = 'Motor de elevación' 
    THEN '❌ CORROMPIDO - tiene formato de puente grúa'
    WHEN (data->>'equipmentType') = 'elevadores' 
         AND (data->'checklist'->0->>'name') = 'Motor elevación'
    THEN '✓ CORRECTO - tiene formato de elevadores'
    WHEN (data->>'equipmentType') = 'puentes-grua'
    THEN '✓ CORRECTO - es puente grúa'
    ELSE '⚠️ VERIFICAR MANUALMENTE'
  END as estado
FROM maintenance_reports
WHERE (data->>'equipmentType') IN ('elevadores', 'puentes-grua')
ORDER BY created_at DESC
LIMIT 10;

-- PASO 3: Ver el checklist completo del último informe de elevadores
WITH ultimo_elevador AS (
  SELECT id, data
  FROM maintenance_reports
  WHERE (data->>'equipmentType') = 'elevadores'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  id,
  (SELECT jsonb_agg(item->>'name') 
   FROM jsonb_array_elements(data->'checklist') item) as items_actuales
FROM ultimo_elevador;

-- ============================================================
-- PASO 4: RESTAURAR EL CHECKLIST DEL INFORME CORROMPIDO
-- ============================================================
-- IMPORTANTE: Primero ejecuta los pasos anteriores para identificar
-- el ID del informe corrompido. Luego descomenta y ejecuta este paso.
-- ============================================================

-- Esta actualización restaura el checklist al formato correcto de ELEVADORES
-- conservando los status y observaciones de cada item (mapeando por posición)

/*
-- DESCOMENTA ESTA SECCIÓN PARA RESTAURAR
-- Reemplaza 'ID_DEL_INFORME_AQUI' con el ID real del informe corrompido

WITH informe_a_restaurar AS (
  SELECT id, data
  FROM maintenance_reports
  WHERE id = 'ID_DEL_INFORME_AQUI'
),
checklist_restaurado AS (
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', COALESCE(item->>'id', gen_random_uuid()::text),
        'name', CASE (row_number() OVER ())::int
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
          ELSE 'Item ' || (row_number() OVER ())::text
        END,
        'status', item->>'status',
        'observation', COALESCE(item->>'observation', '')
      )
    ) as nuevo_checklist
  FROM informe_a_restaurar, 
       jsonb_array_elements(data->'checklist') WITH ORDINALITY AS arr(item, ord)
)
UPDATE maintenance_reports mr
SET data = jsonb_set(
  mr.data,
  '{checklist}',
  cr.nuevo_checklist
)
FROM checklist_restaurado cr
WHERE mr.id = 'ID_DEL_INFORME_AQUI';
*/

-- ============================================================
-- PASO 5: VERIFICACIÓN POST-RESTAURACIÓN
-- ============================================================
-- Después de restaurar, ejecuta esto para verificar que quedó bien:

/*
SELECT 
  id,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as primer_item,
  (data->'checklist'->1->>'name') as segundo_item,
  jsonb_array_length(data->'checklist') as total_items
FROM maintenance_reports
WHERE id = 'ID_DEL_INFORME_AQUI';
*/




