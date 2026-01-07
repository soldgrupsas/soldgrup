# Recuperación de Informes de Puente Grúa

## Problema Identificado

Los informes de mantenimiento de **Puente Grúa** fueron convertidos incorrectamente a tipo **Elevador**, lo que causó la pérdida de datos específicos como:

- Trolley (con sub-items: Motor Trolley, Freno motor Trolley, Guías de Trolley, Ruedas de Trolley)
- Carros testeros (con sub-items: Motorreductor, Freno, Ruedas y palanquilla, Chumaceras)
- Items específicos del checklist de puentes grúa

## ¿Qué se ha hecho?

1. **Código corregido**: Se ha actualizado `MaintenanceReportEditRouter.tsx` para detectar automáticamente los informes de puente grúa basándose en sus datos, no solo en el campo `equipmentType`.

2. **Scripts de diagnóstico y recuperación**: Se han creado dos scripts SQL:
   - `diagnosticar_informes_convertidos.sql` - Para ver qué informes fueron afectados
   - `recuperar_informes_puente_grua.sql` - Para restaurar los datos

## Pasos para Recuperar los Datos

### Paso 1: Diagnosticar

Ejecuta el siguiente script en Supabase SQL Editor para ver los informes afectados:

```sql
-- Ver informes que tienen datos de puente grúa pero tipo "elevadores"
SELECT 
  id,
  company,
  equipment,
  created_at,
  updated_at,
  data->>'equipmentType' as tipo_actual,
  CASE 
    WHEN trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', '') THEN 'SÍ'
    ELSE 'NO'
  END as tiene_trolley,
  CASE 
    WHEN carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', '') THEN 'SÍ'
    ELSE 'NO'
  END as tiene_carros_testeros
FROM maintenance_reports
WHERE 
  (data->>'equipmentType' = 'elevadores' OR data->>'equipmentType' IS NULL)
  AND (
    (trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', ''))
    OR (carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', ''))
  )
ORDER BY updated_at DESC;
```

### Paso 2: Restaurar el tipo de equipo

Si encontraste informes afectados, ejecuta este UPDATE para corregir el `equipmentType`:

```sql
UPDATE maintenance_reports
SET 
  data = jsonb_set(data, '{equipmentType}', '"puentes-grua"')
WHERE 
  (data->>'equipmentType' = 'elevadores' OR data->>'equipmentType' IS NULL)
  AND (
    (trolley_group IS NOT NULL AND trolley_group::text NOT IN ('{}', 'null', ''))
    OR (carros_testeros IS NOT NULL AND carros_testeros::text NOT IN ('{}', 'null', ''))
    OR (motorreductor IS NOT NULL AND motorreductor::text NOT IN ('{}', 'null', ''))
  );
```

### Paso 3: Restaurar datos de Trolley (si se perdieron del campo data)

```sql
UPDATE maintenance_reports
SET 
  data = jsonb_set(data, '{trolleyData}', trolley_group)
WHERE 
  trolley_group IS NOT NULL 
  AND trolley_group::text NOT IN ('{}', 'null', '')
  AND (data->'trolleyData' IS NULL OR data->>'trolleyData' IN ('{}', 'null'));
```

### Paso 4: Restaurar datos de Carros Testeros (si se perdieron)

```sql
UPDATE maintenance_reports
SET 
  data = jsonb_set(data, '{carrosTesteros}', carros_testeros)
WHERE 
  carros_testeros IS NOT NULL 
  AND carros_testeros::text NOT IN ('{}', 'null', '')
  AND (data->'carrosTesteros' IS NULL OR data->>'carrosTesteros' IN ('{}', 'null'));
```

### Paso 5: Verificar la corrección

```sql
SELECT 
  id,
  company,
  equipment,
  data->>'equipmentType' as equipment_type,
  CASE WHEN data->'trolleyData' IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_trolley_data,
  CASE WHEN data->'carrosTesteros' IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_carros_testeros
FROM maintenance_reports
WHERE data->>'equipmentType' = 'puentes-grua'
ORDER BY updated_at DESC;
```

## Prevención Futura

El código ha sido corregido para:

1. **Detectar automáticamente** informes de puente grúa basándose en si tienen datos de `trolley_group`, `carros_testeros` o `motorreductor`

2. **Priorizar los datos reales** sobre el campo `equipmentType` - si un informe tiene datos de puente grúa, se tratará como puente grúa aunque diga "elevadores"

3. **Las columnas dedicadas** (`trolley_group`, `carros_testeros`, `motorreductor`) se sincronizan automáticamente, lo que permite recuperar datos si el campo `data` se corrompe

## Notas Importantes

- Los datos en las columnas `trolley_group`, `carros_testeros` y `motorreductor` se guardan automáticamente mediante triggers
- Estos datos son una copia de respaldo de lo que está en el campo `data`
- El código ahora detecta el tipo correcto automáticamente, pero es importante ejecutar el script de recuperación para los informes ya afectados

