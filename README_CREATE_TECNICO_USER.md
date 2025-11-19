# Crear Usuario "Tecnicos"

Este documento explica cómo crear el usuario "Tecnicos" con acceso solo a mantenimientos.

## Opción 1: Usar la Interfaz de Administración (Recomendado)

1. Inicia sesión como administrador en la aplicación
2. Ve a **Panel de administración** > **Administrar Usuarios**
3. Haz clic en **Crear Usuario**
4. Completa el formulario:
   - **Email**: `tecnicos@soldgrup.com` (o el email que desees)
   - **Full Name**: `Tecnicos`
   - **Password**: `tecnicos2025`
   - **Role**: `Mantenimiento`
5. Haz clic en **Crear Usuario**

## Opción 2: Usar el Script de Node.js

1. Configura las variables de entorno necesarias:
   ```bash
   export SUPABASE_URL="tu_url_de_supabase"
   export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"
   ```

   O crea un archivo `.env` con:
   ```
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

2. Instala las dependencias necesarias (si no están instaladas):
   ```bash
   npm install
   ```

3. Ejecuta el script:
   ```bash
   npx tsx scripts/create-tecnico-user.ts
   ```

   O si tienes ts-node instalado:
   ```bash
   npx ts-node scripts/create-tecnico-user.ts
   ```

## Opción 3: Usar SQL directamente

1. Crea el usuario en Supabase Auth (Dashboard > Authentication > Users > Add User):
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`
   - Full Name: `Tecnicos`
   - Marcar "Auto Confirm User" como verdadero

2. Ejecuta el script SQL `create_tecnico_user.sql` en el SQL Editor de Supabase:
   ```sql
   -- Buscar el usuario por email
   DO $$
   DECLARE
     v_user_id UUID;
     v_user_email TEXT := 'tecnicos@soldgrup.com';
   BEGIN
     SELECT id INTO v_user_id
     FROM auth.users
     WHERE email = v_user_email;
     
     IF v_user_id IS NULL THEN
       RAISE EXCEPTION 'Usuario con email % no encontrado. Por favor crea el usuario primero.', v_user_email;
     END IF;
     
     -- Asignar rol 'mantenimiento'
     PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
     
     RAISE NOTICE 'Usuario % (ID: %) asignado con rol mantenimiento exitosamente', v_user_email, v_user_id;
   END $$;
   ```

## Verificar el Usuario

Después de crear el usuario, verifica que:

1. El usuario puede iniciar sesión con:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`

2. El usuario solo puede ver el módulo de **Informes de Mantenimiento**

3. El usuario NO puede acceder a:
   - Propuestas Comerciales (Dashboard)
   - Equipos
   - Panel de Administración

## Aplicar Cambios de Permisos

Antes de crear el usuario, asegúrate de aplicar la migración que corrige las políticas RLS:

```bash
# Si usas Supabase CLI local
supabase migration up

# O aplica la migración manualmente desde el SQL Editor de Supabase
# Ejecuta el archivo: supabase/migrations/20250105120000_fix_mantenimiento_permissions.sql
```

Esta migración asegura que:
- Los usuarios con rol 'mantenimiento' NO tengan acceso a proposals y equipment
- Los usuarios con rol 'mantenimiento' SÍ tengan acceso a maintenance_reports

## Notas Importantes

- El usuario "Tecnicos" solo tendrá acceso al módulo de mantenimientos
- Las propuestas comerciales y equipos estarán bloqueados para este usuario
- El usuario puede crear, editar y ver informes de mantenimiento
- El usuario puede subir fotos para los informes de mantenimiento

