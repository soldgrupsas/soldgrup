# Instrucciones para Recuperar Equipos de la Propuesta DS-BANAPLAST-5562025

## Opción 1: Usar el Script SQL Directo (Recomendado)

1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el contenido del archivo `recover_equipment_DS-BANAPLAST-5562025.sql`
3. Ejecuta el script
4. Revisa los mensajes en la consola para ver qué equipos se encontraron

## Opción 2: Usar la Función de Recuperación

1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el contenido del archivo `recover_equipment_function.sql`
3. Ejecuta el script (esto creará la función y la ejecutará)
4. Verás una tabla con todos los equipos encontrados y su estado

## Opción 3: Consulta Manual

Si prefieres hacerlo manualmente, ejecuta esta consulta para ver los equipos:

```sql
SELECT 
  ed.id,
  ed.equipment_name,
  ed.equipment_id,
  ed.equipment_specs->>'id' as equipment_specs_id,
  ed.equipment_specs->>'description' as description,
  ed.equipment_specs->>'name' as name_from_specs,
  ed.created_at,
  ed.equipment_specs
FROM public.equipment_details ed
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;
```

Luego, para restaurar los equipment_id:

```sql
UPDATE public.equipment_details
SET equipment_id = (equipment_specs->>'id')::uuid
WHERE proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
AND equipment_specs IS NOT NULL
AND equipment_specs->>'id' IS NOT NULL
AND equipment_id IS NULL
AND (equipment_specs->>'id')::uuid IN (
  SELECT id FROM public.equipment
);
```

## Después de Ejecutar el Script

1. Abre la propuesta en la aplicación
2. Los equipos deberían aparecer automáticamente
3. Si no aparecen, haz clic en el botón "Recuperar Equipos"
4. Los equipos se cargarán desde `equipment_specs` si aún no tienen `equipment_id`

## Nota Importante

- Los equipos solo se pueden restaurar si los datos están en `equipment_specs`
- Si el equipo fue eliminado de la tabla `equipment`, aún se puede recuperar desde `equipment_specs`
- El script intenta restaurar `equipment_id` solo si el equipo aún existe en la tabla `equipment`






