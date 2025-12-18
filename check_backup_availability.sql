-- Script para verificar disponibilidad de backups y datos recuperables
-- Ejecuta este script primero para ver qué opciones tienes

-- 1. Verificar si hay datos en equipment_specs para recuperar
SELECT 
  'Verificando datos recuperables en equipment_specs' as accion,
  COUNT(*) as total_equipment_details,
  COUNT(CASE WHEN equipment_id IS NOT NULL THEN 1 END) as con_equipment_id,
  COUNT(CASE WHEN equipment_specs IS NOT NULL AND equipment_specs->>'id' IS NOT NULL THEN 1 END) as con_equipment_specs_id,
  COUNT(CASE WHEN equipment_id IS NULL AND equipment_specs->>'id' IS NOT NULL THEN 1 END) as recuperables
FROM public.equipment_details
WHERE proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
);

-- 2. Ver detalles de los equipment_details de la propuesta
SELECT 
  ed.id,
  ed.equipment_name,
  ed.equipment_id,
  ed.equipment_specs->>'id' as equipment_specs_id,
  ed.equipment_specs->>'name' as name_from_specs,
  ed.equipment_specs->>'description' as description,
  ed.created_at,
  ed.updated_at,
  CASE 
    WHEN ed.equipment_id IS NOT NULL THEN '✅ Tiene equipment_id - OK'
    WHEN ed.equipment_specs->>'id' IS NOT NULL THEN '⚠️ Tiene equipment_specs.id - RECUPERABLE'
    ELSE '❌ Sin datos recuperables'
  END as estado,
  ed.equipment_specs
FROM public.equipment_details ed
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;

-- 3. Verificar si los equipos referenciados aún existen
SELECT 
  ed.id as equipment_detail_id,
  ed.equipment_name,
  ed.equipment_id,
  ed.equipment_specs->>'id' as equipment_specs_id,
  CASE 
    WHEN ed.equipment_id IS NOT NULL AND e.id IS NOT NULL THEN '✅ Equipo existe y está vinculado'
    WHEN ed.equipment_id IS NOT NULL AND e.id IS NULL THEN '❌ equipment_id apunta a equipo eliminado'
    WHEN ed.equipment_specs->>'id' IS NOT NULL AND e2.id IS NOT NULL THEN '⚠️ Equipo existe pero no está vinculado (recuperable)'
    WHEN ed.equipment_specs->>'id' IS NOT NULL AND e2.id IS NULL THEN '⚠️ Equipo fue eliminado pero hay datos en specs (recuperable parcialmente)'
    ELSE '❌ Sin datos'
  END as estado_equipo,
  e.name as nombre_equipo_actual,
  e2.name as nombre_equipo_en_specs
FROM public.equipment_details ed
LEFT JOIN public.equipment e ON e.id = ed.equipment_id
LEFT JOIN public.equipment e2 ON e2.id = (ed.equipment_specs->>'id')::uuid
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;

-- 4. Ver información de la propuesta
SELECT 
  id,
  offer_id,
  client,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as horas_desde_ultima_actualizacion
FROM public.proposals
WHERE offer_id = 'DS-BANAPLAST-5562025' 
   OR offer_id = 'DS-BANAPLAST- 5562025';






