-- Script para verificar el último informe de elevadores
-- Ejecutar en Supabase SQL Editor

-- 1. Ver los últimos 5 informes con su tipo
SELECT 
  id,
  company,
  technician_name,
  created_at,
  (data->>'equipmentType') as equipment_type,
  CASE 
    WHEN data->>'equipmentType' = 'elevadores' THEN '✓ Elevador'
    WHEN data->>'equipmentType' = 'puentes-grua' THEN '✓ Puente Grúa'
    WHEN data->>'equipmentType' = 'mantenimientos-generales' THEN '✓ General'
    WHEN data->>'equipmentType' IS NULL THEN '⚠️ Legacy (sin tipo)'
    ELSE '❓ Otro: ' || (data->>'equipmentType')
  END as tipo_informe
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 5;

-- 2. Ver el último informe en detalle
SELECT 
  id,
  company,
  technician_name,
  created_at,
  (data->>'equipmentType') as equipment_type,
  -- Verificar si tiene checklist de elevadores (debe tener items como "Sistema de frenos", "Sistema de puertas", etc.)
  jsonb_array_length(data->'checklist') as total_checklist_items,
  -- Ver los primeros 5 items del checklist
  (SELECT jsonb_agg(item->>'name') 
   FROM jsonb_array_elements(data->'checklist') WITH ORDINALITY arr(item, idx)
   WHERE idx <= 5) as primeros_5_items_checklist
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 1;

-- 3. Verificar si el último informe de elevadores tiene los items correctos
-- ITEMS ELEVADORES: Motor elevación, Freno elevación, Guías laterales, Finales de carrera, 
--                   Botoneras, Cabina o canasta, Puertas
-- ITEMS PUENTES GRÚA: Motor de elevación, Freno motor de elevación, Polipasto, 
--                     Límite de elevación, Limitador de carga, Carcazas

WITH ultimo_elevador AS (
  SELECT 
    id,
    company,
    data
  FROM maintenance_reports
  WHERE data->>'equipmentType' = 'elevadores'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  id,
  company,
  (data->>'equipmentType') as equipment_type,
  jsonb_array_length(data->'checklist') as total_items,
  
  -- ITEMS EXCLUSIVOS DE ELEVADORES (si tiene estos, es correcto)
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Motor elevación'  -- Note: SIN "de"
  ) as tiene_motor_elevacion_elev,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Freno elevación'  -- Note: SIN "motor"
  ) as tiene_freno_elevacion_elev,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Guías laterales'
  ) as tiene_guias_laterales,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Finales de carrera'
  ) as tiene_finales_carrera,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Cabina o canasta'
  ) as tiene_cabina_canasta,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Puertas'
  ) as tiene_puertas,
  
  -- ITEMS EXCLUSIVOS DE PUENTES GRÚA (si tiene estos, hay problema)
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Motor de elevación'  -- Con "de"
  ) as PROBLEMA_motor_de_elevacion_pg,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Freno motor de elevación'  -- Con "motor de"
  ) as PROBLEMA_freno_motor_pg,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Polipasto'
  ) as PROBLEMA_polipasto_pg,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'checklist') item 
    WHERE item->>'name' = 'Carcazas'
  ) as PROBLEMA_carcazas_pg
FROM ultimo_elevador;

-- 4. Si el informe se corrompió, aquí están todos los datos para recuperarlos
SELECT 
  id,
  company,
  technician_name,
  created_at,
  data
FROM maintenance_reports
WHERE data->>'equipmentType' = 'elevadores'
ORDER BY created_at DESC
LIMIT 1;

