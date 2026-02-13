-- ============================================================
-- DIAGNÓSTICO DE INFORMES DE MANTENIMIENTO
-- ============================================================
-- Ejecutar en Supabase SQL Editor para ver el estado actual
-- ============================================================

-- 1. Ver TODOS los informes recientes con su tipo y primer item del checklist
SELECT 
  id,
  company,
  technician_name,
  created_at,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as primer_item_checklist,
  (data->'checklist'->1->>'name') as segundo_item_checklist,
  jsonb_array_length(data->'checklist') as total_items
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 10;

-- 2. Ver específicamente el ÚLTIMO informe (sin importar tipo)
SELECT 
  id,
  company,
  technician_name,
  created_at,
  updated_at,
  (data->>'equipmentType') as equipment_type,
  jsonb_array_length(data->'checklist') as total_items,
  (SELECT jsonb_agg(item->>'name') 
   FROM jsonb_array_elements(data->'checklist') item) as todos_los_items
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 1;

-- 3. Contar informes por tipo
SELECT 
  COALESCE(data->>'equipmentType', 'SIN TIPO (legacy)') as tipo,
  COUNT(*) as cantidad
FROM maintenance_reports
GROUP BY data->>'equipmentType'
ORDER BY cantidad DESC;

-- 4. Ver si hay informes de elevadores y su estado
SELECT 
  id,
  company,
  created_at,
  (data->>'equipmentType') as equipment_type,
  (data->'checklist'->0->>'name') as primer_item,
  CASE 
    WHEN (data->'checklist'->0->>'name') ILIKE '%Motor de elevación%' THEN 'Formato PUENTE GRÚA'
    WHEN (data->'checklist'->0->>'name') ILIKE '%Motor elevación%' THEN 'Formato ELEVADOR'
    ELSE 'Otro formato: ' || COALESCE(data->'checklist'->0->>'name', 'NULL')
  END as formato_detectado
FROM maintenance_reports
WHERE (data->>'equipmentType') = 'elevadores'
ORDER BY created_at DESC;











