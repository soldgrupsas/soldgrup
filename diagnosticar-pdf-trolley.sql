-- Script para diagnosticar por qué no aparecen los datos del trolley y carros testeros en el PDF
-- Reemplaza 'TU_EMPRESA' con el nombre de la empresa o el ID del reporte

-- 1. Ver todos los reportes recientes
SELECT 
  id,
  company,
  created_at,
  updated_at
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia por tu empresa
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar si las columnas dedicadas existen y tienen datos
SELECT 
  id,
  company,
  CASE WHEN trolley_group IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_trolley_group_columna,
  CASE WHEN carros_testeros IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_carros_testeros_columna,
  jsonb_typeof(trolley_group) as tipo_trolley_group,
  jsonb_typeof(carros_testeros) as tipo_carros_testeros
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

-- 3. Ver TODAS las claves del objeto data (esto es importante para ver qué se guardó)
SELECT 
  id,
  company,
  jsonb_object_keys(data) as data_keys
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

-- 4. Verificar si trolleyGroup y carrosTesteros existen en el campo data
SELECT 
  id,
  company,
  CASE 
    WHEN data ? 'trolleyGroup' THEN 'EXISTE en data' 
    ELSE 'NO EXISTE en data' 
  END as trolley_group_en_data,
  CASE 
    WHEN data ? 'carrosTesteros' THEN 'EXISTE en data' 
    ELSE 'NO EXISTE en data' 
  END as carros_testeros_en_data,
  jsonb_typeof(data->'trolleyGroup') as tipo_trolley_group_data,
  jsonb_typeof(data->'carrosTesteros') as tipo_carros_testeros_data
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

-- 5. Ver el contenido completo del trolleyGroup si existe
SELECT 
  id,
  company,
  jsonb_pretty(COALESCE(trolley_group, data->'trolleyGroup')) as trolley_group_completo,
  COALESCE(trolley_group->'trolley'->>'status', data->'trolleyGroup'->'trolley'->>'status') as trolley_status,
  COALESCE(trolley_group->'motorTrolley'->>'status', data->'trolleyGroup'->'motorTrolley'->>'status') as motor_trolley_status,
  COALESCE(trolley_group->'frenoMotorTrolley'->>'status', data->'trolleyGroup'->'frenoMotorTrolley'->>'status') as freno_motor_trolley_status,
  COALESCE(trolley_group->'guiasTrolley'->>'status', data->'trolleyGroup'->'guiasTrolley'->>'status') as guias_trolley_status,
  COALESCE(trolley_group->'ruedasTrolley'->>'status', data->'trolleyGroup'->'ruedasTrolley'->>'status') as ruedas_trolley_status
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

-- 6. Ver el contenido completo del carrosTesteros si existe
SELECT 
  id,
  company,
  jsonb_pretty(COALESCE(carros_testeros, data->'carrosTesteros')) as carros_testeros_completo,
  COALESCE(carros_testeros->>'mainStatus', data->'carrosTesteros'->>'mainStatus') as main_status,
  COALESCE(carros_testeros->>'observation', data->'carrosTesteros'->>'observation') as observation,
  jsonb_array_length(COALESCE(carros_testeros->'subItems', data->'carrosTesteros'->'subItems', '[]'::jsonb)) as sub_items_count,
  jsonb_pretty(COALESCE(carros_testeros->'subItems', data->'carrosTesteros'->'subItems')) as sub_items
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

-- 7. Ver la estructura completa del campo data (útil para entender qué se guardó)
SELECT 
  id,
  company,
  jsonb_pretty(data) as data_completo
FROM maintenance_reports
-- WHERE company ILIKE '%TU_EMPRESA%'  -- Descomenta y cambia
ORDER BY created_at DESC
LIMIT 1;

