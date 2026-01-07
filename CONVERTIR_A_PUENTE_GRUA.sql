-- ============================================
-- CONVERSIÓN COMPLETA: Todos los informes a Puente Grúa
-- ============================================
-- Este script convierte TODOS los informes existentes al formato
-- correcto de Puente Grúa, restaurando:
-- 1. El equipmentType correcto
-- 2. El checklist completo de puente grúa (17 items)
-- 3. Los datos de Trolley y Carros testeros
-- ============================================

-- PRIMERO: Ver el estado actual de todos los informes
SELECT 
  id,
  company,
  equipment,
  created_at,
  data->>'equipmentType' as tipo_actual,
  jsonb_array_length(COALESCE(data->'checklist', '[]'::jsonb)) as items_checklist,
  CASE WHEN trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', '') THEN 'SÍ' ELSE 'NO' END as trolley_guardado,
  CASE WHEN carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', '') THEN 'SÍ' ELSE 'NO' END as carros_guardados
FROM maintenance_reports
ORDER BY created_at DESC;

-- ============================================
-- PASO 1: Cambiar equipmentType a 'puentes-grua' en TODOS los informes
-- ============================================
UPDATE maintenance_reports
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb), 
  '{equipmentType}', 
  '"puentes-grua"'
);

-- ============================================
-- PASO 2: Restaurar trolleyData desde la columna trolley_group
-- (para informes que tienen datos guardados en la columna)
-- ============================================
UPDATE maintenance_reports
SET data = jsonb_set(
  data, 
  '{trolleyData}', 
  trolley_group
)
WHERE 
  trolley_group IS NOT NULL 
  AND trolley_group::text NOT IN ('{}', 'null', '')
  AND trolley_group::text != '';

-- ============================================
-- PASO 3: Restaurar carrosTesteros desde la columna carros_testeros
-- ============================================
UPDATE maintenance_reports
SET data = jsonb_set(
  data, 
  '{carrosTesteros}', 
  carros_testeros
)
WHERE 
  carros_testeros IS NOT NULL 
  AND carros_testeros::text NOT IN ('{}', 'null', '')
  AND carros_testeros::text != '';

-- ============================================
-- PASO 4: Crear el checklist de puente grúa para informes que no lo tienen
-- o que tienen el checklist incorrecto (menos de 17 items)
-- ============================================
-- El checklist de puentes grúa tiene estos 17 items:
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

-- Crear función para generar el checklist de puente grúa
CREATE OR REPLACE FUNCTION generate_bridge_crane_checklist(existing_checklist jsonb)
RETURNS jsonb AS $$
DECLARE
  bridge_crane_items text[] := ARRAY[
    'Motor de elevación',
    'Freno motor de elevación', 
    'Estructura',
    'Gancho',
    'Cadena',
    'Guaya',
    'Gabinete eléctrico',
    'Aceite',
    'Sistema de cables planos',
    'Topes mecánicos',
    'Botonera',
    'Pines de seguridad',
    'Polipasto',
    'Límite de elevación',
    'Limitador de carga',
    'Sistema de alimentación de línea blindada',
    'Carcazas'
  ];
  result jsonb := '[]'::jsonb;
  item_name text;
  existing_item jsonb;
  new_item jsonb;
  found_status text;
  found_observation text;
BEGIN
  -- Para cada item del checklist de puente grúa
  FOREACH item_name IN ARRAY bridge_crane_items LOOP
    -- Buscar si existe en el checklist actual (por nombre similar)
    SELECT elem INTO existing_item
    FROM jsonb_array_elements(COALESCE(existing_checklist, '[]'::jsonb)) AS elem
    WHERE 
      lower(elem->>'name') LIKE '%' || lower(split_part(item_name, ' ', 1)) || '%'
      OR lower(elem->>'name') = lower(item_name)
    LIMIT 1;
    
    IF existing_item IS NOT NULL THEN
      -- Usar los datos existentes
      new_item := jsonb_build_object(
        'id', COALESCE(existing_item->>'id', gen_random_uuid()::text),
        'name', item_name,
        'status', existing_item->>'status',
        'observation', COALESCE(existing_item->>'observation', '')
      );
    ELSE
      -- Crear nuevo item vacío
      new_item := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'name', item_name,
        'status', null,
        'observation', ''
      );
    END IF;
    
    result := result || jsonb_build_array(new_item);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Actualizar el checklist de todos los informes
UPDATE maintenance_reports
SET data = jsonb_set(
  data,
  '{checklist}',
  generate_bridge_crane_checklist(data->'checklist')
);

-- Limpiar la función temporal
DROP FUNCTION IF EXISTS generate_bridge_crane_checklist(jsonb);

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as tipo,
  jsonb_array_length(data->'checklist') as items_checklist,
  CASE WHEN data->'trolleyData' IS NOT NULL AND data->>'trolleyData' NOT IN ('{}', 'null') THEN 'SÍ' ELSE 'NO' END as tiene_trolley,
  CASE WHEN data->'carrosTesteros' IS NOT NULL AND data->>'carrosTesteros' NOT IN ('{}', 'null') THEN 'SÍ' ELSE 'NO' END as tiene_carros
FROM maintenance_reports
ORDER BY created_at DESC;

