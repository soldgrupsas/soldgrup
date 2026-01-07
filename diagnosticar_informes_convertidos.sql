-- ============================================
-- DIAGNÓSTICO: Informes de Puente Grúa convertidos a Elevador
-- ============================================
-- Este script identifica informes que:
-- 1. Tienen equipmentType = 'elevadores' PERO
-- 2. Tienen datos de trolley_group o carros_testeros (típicos de puentes grúa)
-- ============================================

-- Ver todos los informes con sus tipos y datos especiales
SELECT 
  id,
  company,
  equipment,
  created_at,
  updated_at,
  data->>'equipmentType' as equipment_type_actual,
  CASE 
    WHEN trolley_group IS NOT NULL AND trolley_group::text != '{}' AND trolley_group::text != 'null' THEN 'SÍ'
    ELSE 'NO'
  END as tiene_trolley_group,
  CASE 
    WHEN carros_testeros IS NOT NULL AND carros_testeros::text != '{}' AND carros_testeros::text != 'null' THEN 'SÍ'
    ELSE 'NO'
  END as tiene_carros_testeros,
  CASE 
    WHEN motorreductor IS NOT NULL AND motorreductor::text != '{}' AND motorreductor::text != 'null' THEN 'SÍ'
    ELSE 'NO'
  END as tiene_motorreductor,
  jsonb_array_length(COALESCE(data->'checklist', '[]'::jsonb)) as items_checklist
FROM maintenance_reports
ORDER BY updated_at DESC;

-- ============================================
-- INFORMES POTENCIALMENTE AFECTADOS:
-- Tienen equipmentType 'elevadores' pero tienen datos de puentes grúa
-- ============================================
SELECT 
  id,
  company,
  equipment,
  created_at,
  updated_at,
  data->>'equipmentType' as equipment_type_actual,
  'POSIBLE PUENTE GRÚA' as diagnostico
FROM maintenance_reports
WHERE 
  (data->>'equipmentType' = 'elevadores' OR data->>'equipmentType' IS NULL)
  AND (
    (trolley_group IS NOT NULL AND trolley_group::text != '{}' AND trolley_group::text != 'null')
    OR (carros_testeros IS NOT NULL AND carros_testeros::text != '{}' AND carros_testeros::text != 'null')
    OR (motorreductor IS NOT NULL AND motorreductor::text != '{}' AND motorreductor::text != 'null')
  )
ORDER BY updated_at DESC;

-- ============================================
-- Ver el detalle de los datos perdidos/convertidos
-- ============================================
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as equipment_type_actual,
  jsonb_pretty(trolley_group) as trolley_group_guardado,
  jsonb_pretty(carros_testeros) as carros_testeros_guardado,
  jsonb_pretty(motorreductor) as motorreductor_guardado
FROM maintenance_reports
WHERE 
  (trolley_group IS NOT NULL AND trolley_group::text != '{}' AND trolley_group::text != 'null')
  OR (carros_testeros IS NOT NULL AND carros_testeros::text != '{}' AND carros_testeros::text != 'null')
ORDER BY updated_at DESC;

-- ============================================
-- Ver checklist original guardado (puede tener los datos de puente grúa)
-- ============================================
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as equipment_type_actual,
  jsonb_array_length(data->'checklist') as num_items_checklist,
  (SELECT string_agg(item->>'name', ', ') 
   FROM jsonb_array_elements(data->'checklist') AS item) as nombres_checklist
FROM maintenance_reports
WHERE data->'checklist' IS NOT NULL
ORDER BY updated_at DESC;

