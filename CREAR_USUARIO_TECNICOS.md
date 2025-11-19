# Crear Usuario "Tecnicos" - Guía Rápida

## Credenciales del Usuario
- **Email**: `tecnicos@soldgrup.com`
- **Contraseña**: `tecnicos2025`
- **Nombre**: `Tecnicos`
- **Rol**: `Mantenimiento`

## Método 1: Usar la Interfaz Web (MÁS FÁCIL) ⭐

1. **Inicia sesión como administrador** en tu aplicación
2. Ve a **Panel de administración** → **Administrar Usuarios**
3. Haz clic en el botón **"Crear Usuario"** o **"+"**
4. Completa el formulario:
   - **Email**: `tecnicos@soldgrup.com`
   - **Full Name**: `Tecnicos`
   - **Password**: `tecnicos2025`
   - **Role**: Selecciona **"Mantenimiento"**
5. Haz clic en **"Crear Usuario"**
6. ¡Listo! El usuario está creado

## Método 2: Usar Script Node.js (Requiere SERVICE_ROLE_KEY)

Si tienes acceso a la `SERVICE_ROLE_KEY` de Supabase:

1. **Obtén tu SERVICE_ROLE_KEY**:
   - Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Ve a **Settings** → **API**
   - Copia el **"service_role" key** (secreto, bajo "Project API keys")

2. **Ejecuta el script**:
   ```bash
   # Opción A: Pasar la clave como argumento
   npx tsx scripts/create-tecnico-user-direct.ts "tu_service_role_key_aqui"
   
   # Opción B: Usar variable de entorno
   export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key_aqui"
   npx tsx scripts/create-tecnico-user-direct.ts
   ```

## Método 3: Crear Manualmente en Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Authentication** → **Users**
3. Haz clic en **"Add User"** → **"Create new user"**
4. Completa:
   - **Email**: `tecnicos@soldgrup.com`
   - **Password**: `tecnicos2025`
   - **Auto Confirm User**: ✅ (activar)
5. Haz clic en **"Create User"**
6. **Asigna el rol** ejecutando este SQL en el SQL Editor:
   ```sql
   DO $$
   DECLARE
     v_user_id UUID;
     v_user_email TEXT := 'tecnicos@soldgrup.com';
   BEGIN
     SELECT id INTO v_user_id
     FROM auth.users
     WHERE email = v_user_email;
     
     IF v_user_id IS NULL THEN
       RAISE EXCEPTION 'Usuario con email % no encontrado.', v_user_email;
     END IF;
     
     PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
     
     RAISE NOTICE 'Usuario % (ID: %) asignado con rol mantenimiento exitosamente', v_user_email, v_user_id;
   END $$;
   ```

## Verificar el Usuario

Después de crear el usuario, verifica que:

1. ✅ El usuario puede iniciar sesión con `tecnicos@soldgrup.com` / `tecnicos2025`
2. ✅ El usuario solo ve el módulo de **"Informes de Mantenimiento"**
3. ✅ El usuario NO puede acceder a:
   - Propuestas Comerciales
   - Equipos
   - Panel de Administración

## Importante: Aplicar Migración de Permisos

Antes de usar el usuario, asegúrate de aplicar la migración que corrige los permisos:

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Ejecuta el contenido del archivo:
   `supabase/migrations/20251205000000_fix_mantenimiento_permissions.sql`

O si usas Supabase CLI:
```bash
supabase migration up
```

Esta migración asegura que:
- Los usuarios con rol 'mantenimiento' NO tengan acceso a proposals y equipment
- Los usuarios con rol 'mantenimiento' SÍ tengan acceso a maintenance_reports

## ¿Problemas?

Si tienes problemas al crear el usuario:

1. **Verifica que el rol 'mantenimiento' existe**:
   ```sql
   SELECT unnest(enum_range(NULL::public.app_role));
   ```
   Debe incluir: `admin`, `user`, `mantenimiento`

2. **Verifica que la migración de permisos está aplicada**:
   ```sql
   SELECT * FROM public.role_module_permissions 
   WHERE role = 'mantenimiento';
   ```
   Debe mostrar acceso solo a `maintenance-reports`

3. **Verifica que el usuario tiene el rol correcto**:
   ```sql
   SELECT ur.user_id, ur.role, p.email, p.full_name
   FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE p.email = 'tecnicos@soldgrup.com';
   ```



