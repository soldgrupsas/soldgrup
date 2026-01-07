-- ============================================
-- FIX RÁPIDO: Convertir TODOS los informes a Puente Grúa
-- ============================================
-- Ejecuta estos comandos en orden en el SQL Editor de Supabase
-- ============================================

-- PASO 1: Ver estado actual
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as tipo_actual,
  jsonb_array_length(COALESCE(data->'checklist', '[]'::jsonb)) as items_checklist
FROM maintenance_reports
ORDER BY created_at DESC;

-- PASO 2: Cambiar TODOS a puentes-grua
UPDATE maintenance_reports
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{equipmentType}', '"puentes-grua"');

-- PASO 3: Restaurar trolleyData desde columna trolley_group (si existe)
UPDATE maintenance_reports
SET data = jsonb_set(data, '{trolleyData}', trolley_group)
WHERE trolley_group IS NOT NULL 
  AND trolley_group::text NOT IN ('{}', 'null', '');

-- PASO 4: Restaurar carrosTesteros desde columna carros_testeros (si existe)  
UPDATE maintenance_reports
SET data = jsonb_set(data, '{carrosTesteros}', carros_testeros)
WHERE carros_testeros IS NOT NULL 
  AND carros_testeros::text NOT IN ('{}', 'null', '');

-- PASO 5: Verificar resultado
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as tipo,
  jsonb_array_length(COALESCE(data->'checklist', '[]'::jsonb)) as items
FROM maintenance_reports
ORDER BY created_at DESC;

