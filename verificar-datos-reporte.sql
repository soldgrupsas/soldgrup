-- Script para verificar los datos de un reporte de mantenimiento
-- Reemplaza 'magnetron' con el nombre de la empresa o usa el ID del reporte

-- 1. Ver todos los reportes recientes
SELECT 
  id,
  company,
  created_at,
  updated_at
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 5;

-- 2. Ver la estructura completa del campo data del reporte más reciente
SELECT 
  id,
  company,
  created_at,
  jsonb_pretty(data) as data_json
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 1;

-- 3. Verificar si trolleyGroup y carrosTesteros existen en el data
SELECT 
  id,
  company,
  CASE 
    WHEN data ? 'trolleyGroup' THEN 'EXISTE' 
    ELSE 'NO EXISTE' 
  END as tiene_trolley_group,
  CASE 
    WHEN data ? 'carrosTesteros' THEN 'EXISTE' 
    ELSE 'NO EXISTE' 
  END as tiene_carros_testeros,
  jsonb_typeof(data->'trolleyGroup') as trolley_group_type,
  jsonb_typeof(data->'carrosTesteros') as carros_testeros_type,
  data->'trolleyGroup' as trolley_group_raw,
  data->'carrosTesteros' as carros_testeros_raw
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 1;

-- 4. Ver TODAS las claves del objeto data (esto es importante para ver qué se guardó)
SELECT 
  id,
  company,
  jsonb_object_keys(data) as data_keys
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 1;

-- 5. Ver el contenido completo del trolleyGroup si existe
SELECT 
  id,
  company,
  jsonb_pretty(data->'trolleyGroup') as trolley_group_completo,
  data->'trolleyGroup'->'trolley'->>'status' as trolley_status,
  data->'trolleyGroup'->'motorTrolley'->>'status' as motor_trolley_status,
  data->'trolleyGroup'->'frenoMotorTrolley'->>'status' as freno_motor_trolley_status,
  data->'trolleyGroup'->'guiasTrolley'->>'status' as guias_trolley_status,
  data->'trolleyGroup'->'ruedasTrolley'->>'status' as ruedas_trolley_status,
  data->'trolleyGroup'->>'observation' as trolley_observation
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 1;

-- 6. Ver el contenido completo del carrosTesteros si existe
SELECT 
  id,
  company,
  jsonb_pretty(data->'carrosTesteros') as carros_testeros_completo,
  data->'carrosTesteros'->>'mainStatus' as main_status,
  data->'carrosTesteros'->>'observation' as observation,
  jsonb_array_length(COALESCE(data->'carrosTesteros'->'subItems', '[]'::jsonb)) as sub_items_count,
  jsonb_pretty(data->'carrosTesteros'->'subItems') as sub_items
FROM maintenance_reports
WHERE company ILIKE '%magnetron%'  -- Cambia esto por el nombre de la empresa
ORDER BY created_at DESC
LIMIT 1;

