-- ⚠️ ADVERTENCIA: Este script es solo para referencia
-- NO ejecutes esto directamente sin entender las consecuencias
-- 
-- Para restaurar toda la base de datos, usa el Dashboard de Supabase:
-- Database → Backups → Point-in-Time Recovery
--
-- Este archivo contiene consultas útiles para verificar antes de restaurar

-- ============================================
-- PASO 1: HACER BACKUP DE DATOS ACTUALES
-- ============================================

-- Exportar equipment_details actuales (por seguridad)
-- Ejecuta esto en psql o desde el Dashboard:
-- COPY (
--   SELECT * FROM public.equipment_details 
--   WHERE proposal_id = (
--     SELECT id FROM public.proposals 
--     WHERE offer_id = 'DS-BANAPLAST-5562025'
--   )
-- ) TO '/tmp/equipment_details_backup.csv' WITH CSV HEADER;

-- ============================================
-- PASO 2: VERIFICAR QUÉ SE PERDERÁ
-- ============================================

-- Ver todas las propuestas modificadas después de una fecha específica
-- (Reemplaza '2024-12-17 08:00:00' con la hora del backup de esta mañana)
SELECT 
  id,
  offer_id,
  client,
  updated_at,
  CASE 
    WHEN updated_at > '2024-12-17 08:00:00'::timestamp THEN '⚠️ Se perderá este cambio'
    ELSE '✅ No se afectará'
  END as estado
FROM public.proposals
WHERE updated_at > '2024-12-17 08:00:00'::timestamp
ORDER BY updated_at DESC;

-- Ver equipment_details creados/modificados después de una fecha
SELECT 
  ed.id,
  ed.equipment_name,
  ed.proposal_id,
  p.offer_id,
  ed.created_at,
  ed.updated_at,
  CASE 
    WHEN ed.created_at > '2024-12-17 08:00:00'::timestamp THEN '⚠️ Se perderá'
    WHEN ed.updated_at > '2024-12-17 08:00:00'::timestamp THEN '⚠️ Se perderán cambios'
    ELSE '✅ No se afectará'
  END as estado
FROM public.equipment_details ed
JOIN public.proposals p ON p.id = ed.proposal_id
WHERE ed.created_at > '2024-12-17 08:00:00'::timestamp
   OR ed.updated_at > '2024-12-17 08:00:00'::timestamp
ORDER BY ed.updated_at DESC;

-- ============================================
-- PASO 3: RESTAURAR DESDE SUPABASE DASHBOARD
-- ============================================

-- NO ejecutes SQL para restaurar toda la base de datos
-- Usa el Dashboard de Supabase:
--
-- 1. Ve a: https://supabase.com/dashboard
-- 2. Selecciona tu proyecto
-- 3. Ve a: Database → Backups
-- 4. Busca: "Point-in-Time Recovery" o "PITR"
-- 5. Selecciona la fecha/hora de esta mañana
-- 6. Haz clic en "Restore to this point"
-- 7. Confirma la restauración
--
-- ⚠️ IMPORTANTE: Esto restaurará TODA la base de datos
-- Todos los cambios después de esa hora se perderán

-- ============================================
-- PASO 4: DESPUÉS DE RESTAURAR
-- ============================================

-- Verificar que los equipos se restauraron
SELECT 
  ed.id,
  ed.equipment_name,
  ed.equipment_id,
  ed.equipment_specs->>'id' as equipment_specs_id,
  ed.created_at,
  CASE 
    WHEN ed.equipment_id IS NOT NULL THEN '✅ Restaurado'
    WHEN ed.equipment_specs->>'id' IS NOT NULL THEN '⚠️ Tiene datos en specs'
    ELSE '❌ Sin datos'
  END as estado
FROM public.equipment_details ed
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;



