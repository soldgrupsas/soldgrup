# Guía para Restaurar el Sistema a un Backup de Esta Mañana

## Opción 1: Point-in-Time Recovery (PITR) - Supabase Dashboard

Si tienes un plan Pro o superior de Supabase, puedes usar Point-in-Time Recovery:

### Pasos:

1. **Accede a Supabase Dashboard**
   - Ve a https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Ve a Database → Backups**
   - En el menú lateral, busca "Database"
   - Haz clic en "Backups"

3. **Selecciona Point-in-Time Recovery**
   - Busca la opción "Point-in-Time Recovery" o "PITR"
   - Selecciona la fecha y hora de esta mañana (antes de que se perdieran los equipos)
   - Haz clic en "Restore to this point"

4. **Confirma la Restauración**
   - ⚠️ **ADVERTENCIA**: Esto restaurará TODA la base de datos a ese punto en el tiempo
   - Se perderán todos los cambios realizados después de esa hora
   - Confirma la acción

## Opción 2: Backup Manual (Si tienes un backup exportado)

Si exportaste un backup manualmente:

1. **Ve a Supabase Dashboard → Database → Backups**
2. **Busca backups manuales** o descargados
3. **Restaura desde el archivo SQL**

## Opción 3: Restaurar Solo los Equipos (Recomendado - Menos Invasivo)

En lugar de restaurar toda la base de datos, podemos restaurar solo los equipos de la propuesta:

### Usando el Script SQL de Recuperación

1. **Abre Supabase Dashboard → SQL Editor**
2. **Ejecuta el script de recuperación** que ya creamos:
   - `recover_equipment_DS-BANAPLAST-5562025.sql`
   - Este script busca los equipos en `equipment_specs` y los restaura

### Verificar si hay datos en equipment_specs

Ejecuta esta consulta primero para ver qué datos tenemos:

```sql
-- Ver todos los equipment_details de la propuesta
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
    WHEN ed.equipment_id IS NOT NULL THEN '✅ Tiene equipment_id'
    WHEN ed.equipment_specs->>'id' IS NOT NULL THEN '⚠️ Tiene equipment_specs.id (recuperable)'
    ELSE '❌ Sin datos recuperables'
  END as estado
FROM public.equipment_details ed
WHERE ed.proposal_id = (
  SELECT id FROM public.proposals 
  WHERE offer_id = 'DS-BANAPLAST-5562025' 
     OR offer_id = 'DS-BANAPLAST- 5562025'
  LIMIT 1
)
ORDER BY ed.created_at;
```

## Opción 4: Contactar Soporte de Supabase

Si no tienes acceso a PITR o backups:

1. **Contacta al soporte de Supabase**
   - Email: support@supabase.com
   - O desde el Dashboard: Settings → Support
2. **Solicita restauración a un punto específico**
   - Menciona la fecha y hora aproximada
   - Indica que necesitas restaurar la propuesta DS-BANAPLAST-5562025

## ⚠️ IMPORTANTE - Antes de Restaurar:

1. **Haz un backup actual** (por si acaso):
   ```sql
   -- Exportar equipment_details actuales
   COPY (
     SELECT * FROM public.equipment_details 
     WHERE proposal_id = (
       SELECT id FROM public.proposals 
       WHERE offer_id = 'DS-BANAPLAST-5562025'
     )
   ) TO STDOUT WITH CSV HEADER;
   ```

2. **Verifica qué otros datos se perderán** si restauras toda la base de datos

3. **Considera restaurar solo los equipos** en lugar de toda la base de datos

## Recomendación

**Primero intenta la Opción 3** (restaurar solo los equipos desde equipment_specs):
- Es menos invasivo
- No afecta otros datos
- Si los datos están en equipment_specs, se pueden recuperar

Si eso no funciona, entonces considera la Opción 1 (PITR) para restaurar toda la base de datos.






