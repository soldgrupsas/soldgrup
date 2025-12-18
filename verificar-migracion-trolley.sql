-- Script para verificar que la migración de columnas dedicadas se haya ejecutado
-- Ejecuta este script en Supabase SQL Editor

-- 1. Verificar si las columnas existen
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'maintenance_reports'
  AND column_name IN ('trolley_group', 'carros_testeros')
ORDER BY column_name;

-- 2. Verificar si el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_sync_maintenance_report_special_fields';

-- 3. Verificar si la función existe
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'sync_maintenance_report_special_fields';

-- 4. Ver cuántos reportes tienen datos en las columnas dedicadas
SELECT 
  COUNT(*) as total_reportes,
  COUNT(trolley_group) as reportes_con_trolley_group,
  COUNT(carros_testeros) as reportes_con_carros_testeros,
  COUNT(CASE WHEN trolley_group IS NOT NULL AND carros_testeros IS NOT NULL THEN 1 END) as reportes_con_ambos
FROM maintenance_reports;

-- 5. Si las columnas no existen, ejecuta la migración:
-- Ve a: supabase/migrations/20251206020000_add_trolley_carros_fields.sql
-- Y ejecuta su contenido en Supabase SQL Editor










