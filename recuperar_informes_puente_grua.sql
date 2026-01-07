-- ============================================
-- RECUPERACIÓN: Restaurar informes de Puente Grúa
-- ============================================
-- Este script corrige informes que fueron convertidos incorrectamente
-- de puente grúa a elevador, restaurando el equipmentType correcto
-- ============================================

-- PRIMERO: Ver qué informes serían afectados (EJECUTAR ESTO PRIMERO)
SELECT 
  id,
  company,
  equipment,
  created_at,
  updated_at,
  data->>'equipmentType' as tipo_actual,
  'puentes-grua' as tipo_correcto,
  CASE 
    WHEN trolley_group IS NOT NULL THEN trolley_group::text
    ELSE 'N/A'
  END as trolley_guardado,
  CASE 
    WHEN carros_testeros IS NOT NULL THEN carros_testeros::text
    ELSE 'N/A'
  END as carros_testeros_guardado
FROM maintenance_reports
WHERE 
  -- Tiene equipmentType de elevadores o nulo
  (data->>'equipmentType' = 'elevadores' OR data->>'equipmentType' IS NULL)
  -- PERO tiene datos de puentes grúa en las columnas dedicadas
  AND (
    (trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', ''))
    OR (carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', ''))
    OR (motorreductor IS NOT NULL AND motorreductor::text NOT IN ('{}', 'null', ''))
  )
ORDER BY updated_at DESC;

-- ============================================
-- PASO 1: Restaurar equipmentType a 'puentes-grua'
-- DESCOMENTAR PARA EJECUTAR
-- ============================================
/*
UPDATE maintenance_reports
SET 
  data = jsonb_set(data, '{equipmentType}', '"puentes-grua"')
WHERE 
  (data->>'equipmentType' = 'elevadores' OR data->>'equipmentType' IS NULL)
  AND (
    (trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', ''))
    OR (carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', ''))
    OR (motorreductor IS NOT NULL AND motorreductor::text NOT IN ('{}', 'null', ''))
  );
*/

-- ============================================
-- PASO 2: Restaurar trolleyGroup desde la columna trolley_group
-- (si se perdió del campo data pero está en la columna)
-- DESCOMENTAR PARA EJECUTAR
-- ============================================
/*
UPDATE maintenance_reports
SET 
  data = jsonb_set(
    data, 
    '{trolleyData}', 
    trolley_group
  )
WHERE 
  trolley_group IS NOT NULL 
  AND trolley_group::text NOT IN ('{}', 'null', '')
  AND (data->'trolleyData' IS NULL OR data->>'trolleyData' IN ('{}', 'null'));
*/

-- ============================================
-- PASO 3: Restaurar carrosTesteros desde la columna carros_testeros
-- DESCOMENTAR PARA EJECUTAR
-- ============================================
/*
UPDATE maintenance_reports
SET 
  data = jsonb_set(
    data, 
    '{carrosTesteros}', 
    carros_testeros
  )
WHERE 
  carros_testeros IS NOT NULL 
  AND carros_testeros::text NOT IN ('{}', 'null', '')
  AND (data->'carrosTesteros' IS NULL OR data->>'carrosTesteros' IN ('{}', 'null'));
*/

-- ============================================
-- VERIFICACIÓN: Ver informes después de la corrección
-- ============================================
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as equipment_type,
  CASE WHEN data->'trolleyData' IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_trolley_data,
  CASE WHEN data->'carrosTesteros' IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_carros_testeros
FROM maintenance_reports
WHERE 
  (trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', ''))
  OR (carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', ''))
ORDER BY updated_at DESC;

-- ============================================
-- CASO ESPECIAL: Si el checklist también se perdió
-- Este query muestra los items originales del checklist de puentes grúa
-- que deberían estar presentes
-- ============================================
-- Items de Puentes Grúa:
-- 1. Motor de elevación
-- 2. Freno motor de elevación
-- 3. Estructura
-- 4. Gancho
-- 5. Cadena
-- 6. Guaya
-- 7. Gabinete eléctrico
-- 8. Aceite
-- 9. Sistema de cables planos
-- 10. Topes mecánicos
-- 11. Botonera
-- 12. Pines de seguridad
-- 13. Polipasto
-- 14. Límite de elevación
-- 15. Limitador de carga
-- 16. Sistema de alimentación de línea blindada
-- 17. Carcazas
-- + Trolley (con sub-items)
-- + Carros testeros (con sub-items)

