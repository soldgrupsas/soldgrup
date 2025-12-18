-- ============================================================================
-- Script para actualizar la estructura de motorreductor en maintenance_reports
-- Este script agrega la estructura de subItems a los registros que no la tienen
-- ============================================================================
--
-- INSTRUCCIONES:
-- 1. Ejecuta primero los PASOS 1 y 2 para verificar el estado actual de tus datos
-- 2. Revisa qué sub-items debería tener motorreductor (consulta con tu equipo)
-- 3. Ajusta el PASO 3 (Opción A o B) con los sub-items correctos
-- 4. Ejecuta los PASOS 3-5 para actualizar los datos
-- 5. Ejecuta el PASO 6 para verificar que todo se actualizó correctamente
--
-- NOTA: Este script NO elimina datos existentes, solo agrega la estructura faltante
-- ============================================================================

-- PASO 1: Verificar el estado actual de los datos
-- Ejecuta esto primero para ver qué registros necesitan actualización
SELECT 
    id,
    created_at,
    CASE 
        WHEN motorreductor IS NULL THEN 'Sin motorreductor'
        WHEN motorreductor->>'subItems' IS NULL THEN 'Sin subItems'
        WHEN jsonb_array_length(COALESCE(motorreductor->'subItems', '[]'::jsonb)) = 0 THEN 'subItems vacío'
        ELSE 'Tiene subItems (' || jsonb_array_length(motorreductor->'subItems') || ' items)'
    END as estado_motorreductor,
    motorreductor->>'mainStatus' as main_status,
    CASE 
        WHEN motorreductor->'subItems' IS NOT NULL 
        THEN jsonb_array_length(motorreductor->'subItems')
        ELSE 0
    END as cantidad_subitems
FROM maintenance_reports
WHERE motorreductor IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 2: Verificar estructura completa de un registro de ejemplo
-- ============================================================================
SELECT 
    id,
    motorreductor,
    jsonb_pretty(motorreductor) as motorreductor_formateado
FROM maintenance_reports
WHERE motorreductor IS NOT NULL
LIMIT 1;

-- ============================================================================
-- PASO 3: Actualizar registros que tienen motorreductor pero sin subItems
-- IMPORTANTE: Ajusta los sub-items según tus necesidades
-- ============================================================================

-- Opción A: Si motorreductor debería tener los mismos sub-items que carrosTesteros
-- (Freno, Ruedas, Chumaceras, Palanquilla) - NOTA: Motorreductor ya no es sub-item, es item principal
UPDATE maintenance_reports
SET motorreductor = jsonb_set(
    COALESCE(motorreductor, '{}'::jsonb),
    '{subItems}',
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Freno', 'status', null, 'observation', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Ruedas', 'status', null, 'observation', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Chumaceras', 'status', null, 'observation', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Palanquilla', 'status', null, 'observation', '')
    )
)
WHERE motorreductor IS NOT NULL
  AND (
    motorreductor->'subItems' IS NULL 
    OR jsonb_array_length(COALESCE(motorreductor->'subItems', '[]'::jsonb)) = 0
  );

-- Opción B: Si motorreductor debería tener sub-items diferentes
-- Descomenta y ajusta según tus necesidades:
/*
UPDATE maintenance_reports
SET motorreductor = jsonb_set(
    COALESCE(motorreductor, '{}'::jsonb),
    '{subItems}',
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Sub-item 1', 'status', null, 'observation', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Sub-item 2', 'status', null, 'observation', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Sub-item 3', 'status', null, 'observation', '')
    )
)
WHERE motorreductor IS NOT NULL
  AND (
    motorreductor->'subItems' IS NULL 
    OR jsonb_array_length(COALESCE(motorreductor->'subItems', '[]'::jsonb)) = 0
  );
*/

-- ============================================================================
-- PASO 4: Asegurar que todos los registros tengan la estructura completa
-- (mainStatus, subItems, observation)
-- ============================================================================

-- Agregar mainStatus si no existe
UPDATE maintenance_reports
SET motorreductor = jsonb_set(
    COALESCE(motorreductor, '{}'::jsonb),
    '{mainStatus}',
    'null'::jsonb
)
WHERE motorreductor IS NOT NULL
  AND motorreductor->>'mainStatus' IS NULL;

-- Agregar observation si no existe
UPDATE maintenance_reports
SET motorreductor = jsonb_set(
    COALESCE(motorreductor, '{}'::jsonb),
    '{observation}',
    '""'::jsonb
)
WHERE motorreductor IS NOT NULL
  AND motorreductor->>'observation' IS NULL;

-- ============================================================================
-- PASO 5: Sincronizar desde data.motorreductor si existe pero no en columna dedicada
-- ============================================================================

UPDATE maintenance_reports
SET motorreductor = data->'motorreductor'
WHERE motorreductor IS NULL
  AND data->>'motorreductor' IS NOT NULL;

-- También verificar en data.data.motorreductor (estructura anidada)
UPDATE maintenance_reports
SET motorreductor = data->'data'->'motorreductor'
WHERE motorreductor IS NULL
  AND data->'data'->>'motorreductor' IS NOT NULL;

-- ============================================================================
-- PASO 6: Verificar resultados después de la actualización
-- ============================================================================

SELECT 
    COUNT(*) as total_registros,
    COUNT(CASE WHEN motorreductor IS NOT NULL THEN 1 END) as con_motorreductor,
    COUNT(CASE WHEN motorreductor->'subItems' IS NOT NULL 
               AND jsonb_array_length(motorreductor->'subItems') > 0 THEN 1 END) as con_subitems,
    COUNT(CASE WHEN motorreductor->>'mainStatus' IS NOT NULL THEN 1 END) as con_mainstatus,
    COUNT(CASE WHEN motorreductor->>'observation' IS NOT NULL THEN 1 END) as con_observation
FROM maintenance_reports;

-- Ver algunos registros actualizados
SELECT 
    id,
    created_at,
    motorreductor->>'mainStatus' as main_status,
    jsonb_array_length(COALESCE(motorreductor->'subItems', '[]'::jsonb)) as cantidad_subitems,
    jsonb_pretty(motorreductor) as estructura_completa
FROM maintenance_reports
WHERE motorreductor IS NOT NULL
  AND motorreductor->'subItems' IS NOT NULL
  AND jsonb_array_length(motorreductor->'subItems') > 0
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Este script preserva los datos existentes (mainStatus, observation)
-- 2. Solo agrega subItems si no existen o están vacíos
-- 3. Ajusta los nombres de los sub-items en el PASO 3 según tus necesidades
-- 4. Los UUIDs se generan automáticamente con gen_random_uuid()
-- 5. Ejecuta primero los PASOS 1 y 2 para verificar el estado actual
-- 6. Luego ejecuta los PASOS 3-5 para actualizar
-- 7. Finalmente ejecuta el PASO 6 para verificar los resultados
--
-- ¿NO ESTÁS SEGURO DE QUÉ SUB-ITEMS DEBERÍA TENER MOTORREDUCTOR?
-- - Revisa el código frontend en MaintenanceReportWizard.tsx
-- - Busca si hay una función buildDefaultMotorreductor()
-- - O consulta con el equipo qué componentes tiene un motorreductor
-- - Por defecto, he puesto los mismos que carrosTesteros (sin Motorreductor)
-- ============================================================================

