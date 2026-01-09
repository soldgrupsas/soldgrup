-- ============================================================
-- CORREGIR current_step DEL ÚLTIMO INFORME
-- ============================================================
-- Este script corrige el current_step del informe que está causando
-- el bucle en la navegación.
-- ============================================================

-- PASO 1: Ver el estado actual del informe
SELECT 
  id,
  company,
  current_step,
  (data->>'equipmentType') as equipment_type,
  jsonb_array_length(data->'checklist') as total_checklist_items,
  -- Para elevadores: 1 intro + 1 basicInfo + 1 initialState + 15 checklist + 1 recommendations + 1 tests + 1 photos + 1 finish = 22 pasos
  -- El current_step guardado no debe ser mayor a 22
  CASE 
    WHEN current_step > 22 AND (data->>'equipmentType') = 'elevadores' 
    THEN '❌ current_step muy alto para elevadores'
    ELSE '✓ OK'
  END as estado_current_step
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 3;

-- PASO 2: Corregir el current_step del último informe de elevadores
-- Lo ponemos en el paso 1 (inicio) para que el usuario pueda navegar correctamente
UPDATE maintenance_reports
SET current_step = 1
WHERE id = (
  SELECT id 
  FROM maintenance_reports 
  WHERE (data->>'equipmentType') = 'elevadores'
  ORDER BY created_at DESC 
  LIMIT 1
);

-- PASO 3: Verificar que se corrigió
SELECT 
  id,
  company,
  current_step,
  (data->>'equipmentType') as equipment_type,
  CASE 
    WHEN current_step = 1 THEN '✅ current_step corregido a 1 (inicio)'
    ELSE 'current_step: ' || current_step::text
  END as estado
FROM maintenance_reports
ORDER BY created_at DESC
LIMIT 1;


