# 🚀 Setup Completo - Usuario "Tecnicos"

## ✅ Credenciales del Usuario
- **Email**: `tecnicos@soldgrup.com`
- **Contraseña**: `tecnicos2025`
- **Nombre**: `Tecnicos`
- **Rol**: `mantenimiento`

## 📋 Pasos para Configurar Todo

### Paso 1: Aplicar Migración y Crear Usuario (Recomendado)

**Opción A: Script SQL Completo (TODO EN UNO)** ⭐

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Abre el archivo `setup-tecnico-user.sql`
4. Copia y pega **TODO** el contenido
5. Haz clic en **"Run"** o presiona `Ctrl+Enter`
6. Verifica que no haya errores (debe mostrar mensajes de éxito)
7. Si el usuario no existe, el script te indicará cómo crearlo

**Opción B: Paso por Paso**

1. **Aplicar migración de permisos**:
   - Ve a **SQL Editor** en Supabase Dashboard
   - Ejecuta el contenido de `supabase/migrations/20251205000000_fix_mantenimiento_permissions.sql`

2. **Crear el usuario**:
   - Ve a **Authentication** → **Users** → **Add User**
   - Completa:
     - Email: `tecnicos@soldgrup.com`
     - Password: `tecnicos2025`
     - Full Name: `Tecnicos`
     - Auto Confirm User: ✅ (activar)
   - Haz clic en **"Create User"**

3. **Asignar el rol**:
   - Ve a **SQL Editor**
   - Ejecuta:
   ```sql
   DO $$
   DECLARE
     v_user_id UUID;
     v_user_email TEXT := 'tecnicos@soldgrup.com';
   BEGIN
     SELECT id INTO v_user_id
     FROM auth.users
     WHERE email = v_user_email;
     
     PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
     
     RAISE NOTICE 'Usuario % (ID: %) asignado con rol mantenimiento exitosamente', v_user_email, v_user_id;
   END $$;
   ```

### Paso 2: Verificar que Todo Funciona

1. **Verifica el usuario**:
   ```sql
   SELECT ur.user_id, ur.role, p.email, p.full_name
   FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE p.email = 'tecnicos@soldgrup.com';
   ```
   Debe mostrar: `role: mantenimiento`

2. **Verifica los permisos**:
   ```sql
   SELECT m.module_key, m.module_name, rmp.has_access
   FROM public.role_module_permissions rmp
   JOIN public.modules m ON m.id = rmp.module_id
   WHERE rmp.role = 'mantenimiento'::public.app_role;
   ```
   Debe mostrar acceso solo a: `maintenance-reports`

3. **Prueba el login**:
   - Ve a tu aplicación en localhost
   - Inicia sesión con:
     - Email: `tecnicos@soldgrup.com`
     - Password: `tecnicos2025`
   - Debes ver solo el módulo de **"Informes de Mantenimiento"**
   - NO debes ver: Propuestas Comerciales, Equipos, Panel de Administración

## 🎯 ¿Qué Hace el Script?

El script `setup-tecnico-user.sql` hace TODO automáticamente:

1. ✅ **Aplica la migración de permisos**:
   - Bloquea acceso de 'mantenimiento' a proposals y equipment
   - Permite acceso de 'mantenimiento' a maintenance_reports
   - Actualiza políticas de storage para fotos de mantenimiento

2. ✅ **Crea/verifica el usuario**:
   - Verifica si el usuario existe
   - Si no existe, te da instrucciones para crearlo
   - Si existe, asigna el rol 'mantenimiento'

3. ✅ **Verifica la configuración**:
   - Verifica que el rol fue asignado
   - Verifica que los permisos están configurados

## 🆘 Solución de Problemas

### El usuario no se crea

1. **Crea el usuario manualmente** desde Supabase Dashboard:
   - Authentication → Users → Add User
   - Usa las credenciales: `tecnicos@soldgrup.com` / `tecnicos2025`
   - Activa "Auto Confirm User"

2. **Ejecuta el script de nuevo** para asignar el rol

### El usuario no puede iniciar sesión

1. **Verifica que el usuario existe**:
   ```sql
   SELECT id, email, email_confirmed_at
   FROM auth.users
   WHERE email = 'tecnicos@soldgrup.com';
   ```
   `email_confirmed_at` no debe ser NULL

2. **Verifica la contraseña**: Debe ser exactamente `tecnicos2025`

### El usuario ve módulos que no debería

1. **Verifica que aplicaste la migración de permisos**
2. **Verifica el rol del usuario**:
   ```sql
   SELECT role FROM public.user_roles
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tecnicos@soldgrup.com');
   ```
   Debe ser: `mantenimiento`

3. **Verifica los permisos del rol**:
   ```sql
   SELECT m.module_key, rmp.has_access
   FROM public.role_module_permissions rmp
   JOIN public.modules m ON m.id = rmp.module_id
   WHERE rmp.role = 'mantenimiento'::public.app_role;
   ```
   Solo debe tener acceso a: `maintenance-reports`

### Error al ejecutar el script SQL

1. **Verifica que el rol 'mantenimiento' existe**:
   ```sql
   SELECT unnest(enum_range(NULL::public.app_role));
   ```
   Debe incluir: `admin`, `user`, `mantenimiento`

2. **Verifica que las funciones existen**:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'assign_user_role';
   ```
   Debe existir la función `assign_user_role`

3. **Si hay errores**, ejecuta el script por partes:
   - Primero la parte de permisos
   - Luego la parte de creación de usuario

## 📝 Notas Importantes

- ✅ El usuario "Tecnicos" solo puede ver y gestionar informes de mantenimiento
- ❌ NO puede acceder a propuestas comerciales ni equipos
- ❌ NO puede acceder al panel de administración
- ✅ Puede crear, editar y ver informes de mantenimiento
- ✅ Puede subir fotos para los informes de mantenimiento

## 🎉 ¡Listo!

Una vez completado el setup, el usuario "Tecnicos" está listo para usar:

1. ✅ Inicia sesión con: `tecnicos@soldgrup.com` / `tecnicos2025`
2. ✅ Solo verá el módulo de "Informes de Mantenimiento"
3. ✅ No podrá acceder a otras secciones

¡Prueba en localhost y luego sincroniza cuando estés listo!
































