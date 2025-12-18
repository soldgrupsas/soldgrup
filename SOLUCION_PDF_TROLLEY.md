# 🔍 Solución: Datos del Trolley y Carro Testero no aparecen en el PDF

## 📋 Pasos para Diagnosticar el Problema

### Paso 1: Verificar los Datos en la Base de Datos

Ejecuta el script `diagnosticar-pdf-trolley.sql` en Supabase SQL Editor:

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Abre el archivo `diagnosticar-pdf-trolley.sql`
3. **IMPORTANTE**: Reemplaza `'TU_EMPRESA'` con el nombre de la empresa o ID del reporte
4. Ejecuta las consultas una por una

**Esto te mostrará:**
- Si las columnas dedicadas (`trolley_group`, `carros_testeros`) tienen datos
- Si los datos están en el campo `data` 
- Qué estructura tienen los datos guardados

### Paso 2: Ver los Logs del Generador de PDF

Cuando generes un PDF, revisa los logs en Supabase:

1. Ve a **Supabase Dashboard** → **Edge Functions** → **generate-maintenance-report-pdf**
2. Abre la pestaña **Logs**
3. Busca los mensajes que dicen:
   - `=== DEBUG: Checking for trolleyGroup and carrosTesteros ===`
   - `✅ Found trolleyGroup in...` o `❌ trolleyGroup NOT FOUND`
   - `✅ Found carrosTesteros in...` o `❌ carrosTesteros NOT FOUND`

**Esto te dirá exactamente dónde se están buscando los datos y si se encuentran.**

### Paso 3: Verificar que los Datos se Estén Guardando

Asegúrate de que cuando guardas el informe de mantenimiento, los datos del trolley y carro testero realmente se estén guardando:

1. Abre un informe de mantenimiento existente
2. Verifica que los datos del trolley y carro testero estén llenos en el formulario
3. Guarda el informe
4. Ejecuta el script de diagnóstico para verificar que se guardaron

## 🛠️ Soluciones Posibles

### Solución 1: Los Datos no se Están Guardando

**Síntoma**: Los logs muestran `❌ trolleyGroup NOT FOUND` o `❌ carrosTesteros NOT FOUND`

**Solución**: 
- Verifica que estás guardando el informe correctamente
- Revisa que los campos del trolley y carro testero estén llenos antes de guardar
- Verifica en la base de datos que los datos estén en el campo `data`

### Solución 2: Los Datos Están en un Formato Diferente

**Síntoma**: El script SQL muestra que los datos existen pero con una estructura diferente

**Solución**:
Los datos deberían estar en:
- `data->'trolleyGroup'` o
- `data->'carrosTesteros'`

Si están en otra ubicación, necesitamos ajustar el código de búsqueda.

### Solución 3: La Migración no Sincronizó los Datos

**Síntoma**: Las columnas dedicadas están vacías pero los datos están en el campo `data`

**Solución**: Ejecuta este SQL para sincronizar manualmente:

```sql
UPDATE public.maintenance_reports
SET 
  trolley_group = data->'trolleyGroup',
  carros_testeros = data->'carrosTesteros'
WHERE 
  (trolley_group IS NULL OR carros_testeros IS NULL)
  AND (data->'trolleyGroup' IS NOT NULL OR data->'carrosTesteros' IS NOT NULL);
```

## 📝 Cambios Realizados en el Código

1. **Logs Mejorados**: Ahora hay logs detallados que muestran exactamente dónde se buscan y encuentran los datos
2. **Búsqueda en Múltiples Ubicaciones**: El código busca en:
   - Columnas dedicadas (`trolley_group`, `carros_testeros`)
   - Campo `data` en el nivel raíz
   - Campo `data` anidado (`data->data`)
3. **Fallback para Filas Vacías**: Si no se encuentran datos, al menos se muestran las filas vacías en el PDF

## ⚠️ Importante

**Después de revisar los logs y el script SQL**, comparte los resultados:

1. ¿Qué muestran los logs del generador de PDF?
2. ¿Qué muestra el script SQL de diagnóstico?
3. ¿Los datos están en el campo `data` o en las columnas dedicadas?

Con esta información podremos ajustar el código específicamente para tu caso.

## 🔄 Próximos Pasos

1. Ejecuta el script de diagnóstico
2. Genera un PDF y revisa los logs
3. Comparte los resultados para poder ayudarte mejor













