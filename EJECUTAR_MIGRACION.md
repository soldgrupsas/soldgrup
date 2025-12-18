# 🚀 Cómo Ejecutar la Migración de Trolley y Carros Testeros

Esta migración agrega columnas dedicadas para mejorar el rendimiento y acceso a los datos del trolley y carros testeros en los informes de mantenimiento.

## 📋 Opción 1: Desde Supabase Dashboard (MÁS FÁCIL) ⭐

### Pasos:

1. **Inicia sesión** en [Supabase Dashboard](https://app.supabase.com)
   
2. **Selecciona tu proyecto** en la lista

3. **Ve a SQL Editor**:
   - En el menú lateral izquierdo, busca **"SQL Editor"**
   - Haz clic para abrirlo

4. **Crea una nueva consulta**:
   - Haz clic en el botón **"New query"** (Nueva consulta)

5. **Copia y pega el contenido** del archivo de migración:
   - Abre el archivo: `supabase/migrations/20251206020000_add_trolley_carros_fields.sql`
   - Copia TODO el contenido (Ctrl+A, Ctrl+C)
   - Pégalo en el SQL Editor (Ctrl+V)

6. **Ejecuta la migración**:
   - Haz clic en el botón **"Run"** (o presiona `Ctrl+Enter`)
   - Espera a que termine la ejecución

7. **Verifica el resultado**:
   - Deberías ver mensajes de éxito como:
     - `ALTER TABLE`
     - `CREATE INDEX`
     - `CREATE FUNCTION`
     - `CREATE TRIGGER`
     - `UPDATE` (actualizando registros existentes)

8. **Si hay errores**:
   - Revisa el mensaje de error
   - La mayoría de errores comunes son porque las columnas ya existen (esto es seguro, el script usa `IF NOT EXISTS`)

## 📋 Opción 2: Usando Supabase CLI

Si tienes Supabase CLI instalado y configurado:

1. **Abre una terminal** en la raíz del proyecto

2. **Conecta con tu proyecto remoto** (si aún no lo has hecho):
   ```bash
   supabase link --project-ref tu-project-ref
   ```

3. **Aplica la migración**:
   ```bash
   supabase db push
   ```

   O para aplicar solo esta migración específica:
   ```bash
   supabase migration up
   ```

## 📋 Opción 3: Ejecutar SQL Manualmente

Si prefieres ejecutar cada parte por separado:

1. **Abre SQL Editor** en Supabase Dashboard

2. **Ejecuta cada sección** del archivo de migración una por una:

   - Primero las columnas:
     ```sql
     ALTER TABLE public.maintenance_reports
     ADD COLUMN IF NOT EXISTS trolley_group jsonb,
     ADD COLUMN IF NOT EXISTS carros_testeros jsonb;
     ```

   - Luego los índices:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_maintenance_reports_trolley_group 
     ON public.maintenance_reports USING gin (trolley_group);
     
     CREATE INDEX IF NOT EXISTS idx_maintenance_reports_carros_testeros 
     ON public.maintenance_reports USING gin (carros_testeros);
     ```

   - Y así sucesivamente con las demás partes

## ✅ Verificar que la Migración se Aplicó Correctamente

Después de ejecutar la migración, verifica que todo está bien:

```sql
-- Verificar que las columnas existen
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'maintenance_reports' 
AND column_name IN ('trolley_group', 'carros_testeros');

-- Verificar que el trigger existe
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_maintenance_report_special_fields';

-- Verificar que hay datos sincronizados (si hay reportes existentes)
SELECT 
  id,
  CASE WHEN trolley_group IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_trolley,
  CASE WHEN carros_testeros IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_carros
FROM public.maintenance_reports
LIMIT 5;
```

## 🔍 ¿Qué Hace Esta Migración?

1. **Agrega columnas dedicadas**: `trolley_group` y `carros_testeros` como JSONB
2. **Crea índices**: Para búsquedas más rápidas
3. **Crea función de sincronización**: Para mantener los datos sincronizados automáticamente
4. **Crea trigger**: Sincroniza automáticamente cuando se inserta o actualiza un reporte
5. **Backfill**: Copia los datos existentes desde el campo `data` a las nuevas columnas

## ⚠️ Notas Importantes

- ✅ La migración es **segura**: Usa `IF NOT EXISTS` para evitar errores si algo ya existe
- ✅ Es **retrocompatible**: Los datos siguen guardándose en el campo `data`
- ✅ **No pierde datos**: Copia los datos existentes a las nuevas columnas
- ✅ **Automática**: El trigger mantiene todo sincronizado automáticamente

## 🐛 Solución de Problemas

### Error: "relation already exists"
✅ **Esto es normal**: Significa que alguna parte ya estaba creada. La migración continúa con el resto.

### Error: "permission denied"
❌ **Problema**: No tienes permisos. 
✅ **Solución**: Asegúrate de estar ejecutando como administrador del proyecto.

### Error: "syntax error"
❌ **Problema**: Puede ser que copiaste solo una parte del archivo.
✅ **Solución**: Asegúrate de copiar TODO el contenido del archivo de migración.

## 📞 ¿Necesitas Ayuda?

Si tienes problemas, revisa:
1. Los logs en el SQL Editor de Supabase
2. Que el archivo de migración esté completo
3. Que tengas permisos de administrador en el proyecto













