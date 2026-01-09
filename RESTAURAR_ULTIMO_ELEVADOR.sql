-- ============================================================
-- RESTAURAR ÚLTIMO INFORME DE ELEVADORES CORROMPIDO
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- Este script restaura el checklist del último informe de elevadores
-- que fue incorrectamente convertido a formato de puente grúa.
-- ============================================================

-- PASO 1: Ver el último informe de elevadores y verificar si está corrompido
SELECT 
  id,
  company,
  technician_name,
  created_at,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as primer_item,
  CASE 
    WHEN (data->'checklist'->0->>'name') = 'Motor de elevación' THEN '❌ CORROMPIDO'
    WHEN (data->'checklist'->0->>'name') = 'Motor elevación' THEN '✓ CORRECTO'
    ELSE '⚠️ VERIFICAR'
  END as estado
FROM maintenance_reports
WHERE (data->>'equipmentType') = 'elevadores'
ORDER BY created_at DESC
LIMIT 1;

-- PASO 2: RESTAURAR EL CHECKLIST
-- Este UPDATE restaura los nombres correctos de elevadores manteniendo los status y observaciones
-- Los items de ELEVADORES son:
-- 1. Motor elevación (NO "Motor de elevación")
-- 2. Freno elevación (NO "Freno motor de elevación")
-- 3. Estructura
-- 4. Gancho
-- 5. Cadena
-- 6. Guaya
-- 7. Gabinete eléctrico
-- 8. Guías laterales (NO "Sistema de cables planos")
-- 9. Finales de carrera (NO "Polipasto")
-- 10. Topes mecánicos
-- 11. Aceite
-- 12. Botoneras (NO "Botonera")
-- 13. Pines de seguridad
-- 14. Cabina o canasta (NO "Límite de elevación")
-- 15. Puertas (NO "Limitador de carga")

WITH ultimo_elevador AS (
  SELECT id
  FROM maintenance_reports
  WHERE (data->>'equipmentType') = 'elevadores'
  ORDER BY created_at DESC
  LIMIT 1
),
items_correctos AS (
  SELECT ARRAY[
    'Motor elevación',
    'Freno elevación',
    'Estructura',
    'Gancho',
    'Cadena',
    'Guaya',
    'Gabinete eléctrico',
    'Guías laterales',
    'Finales de carrera',
    'Topes mecánicos',
    'Aceite',
    'Botoneras',
    'Pines de seguridad',
    'Cabina o canasta',
    'Puertas'
  ] as nombres
)
UPDATE maintenance_reports mr
SET data = jsonb_set(
  mr.data,
  '{checklist}',
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', COALESCE(item->>'id', gen_random_uuid()::text),
        'name', (SELECT nombres[ord::int] FROM items_correctos),
        'status', item->>'status',
        'observation', COALESCE(item->>'observation', '')
      )
      ORDER BY ord
    )
    FROM jsonb_array_elements(mr.data->'checklist') WITH ORDINALITY AS arr(item, ord)
    WHERE ord <= 15
  )
)
FROM ultimo_elevador ue
WHERE mr.id = ue.id
  AND (mr.data->'checklist'->0->>'name') = 'Motor de elevación';  -- Solo actualizar si está corrompido

-- PASO 3: Verificar que se restauró correctamente
SELECT 
  id,
  company,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as item_1,
  (data->'checklist'->1->>'name') as item_2,
  (data->'checklist'->7->>'name') as item_8_guias,
  (data->'checklist'->8->>'name') as item_9_finales,
  (data->'checklist'->13->>'name') as item_14_cabina,
  (data->'checklist'->14->>'name') as item_15_puertas,
  jsonb_array_length(data->'checklist') as total_items
FROM maintenance_reports
WHERE (data->>'equipmentType') = 'elevadores'
ORDER BY created_at DESC
LIMIT 1;


