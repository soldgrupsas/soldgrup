# 🚀 Inicio Rápido - Usuario "Tecnicos"

## ✅ Credenciales
- **Email**: `tecnicos@soldgrup.com`
- **Contraseña**: `tecnicos2025`
- **Rol**: `mantenimiento`

## 📋 Pasos Rápidos (5 minutos)

### Paso 1: Aplicar Migración y Configurar Permisos

1. **Ve a Supabase Dashboard**:
   - Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Ve a **SQL Editor**

2. **Ejecuta el script completo**:
   - Abre el archivo `setup-tecnico-user.sql`
   - Copia y pega **TODO** el contenido en el SQL Editor
   - Haz clic en **"Run"** o presiona `Ctrl+Enter`
   - Verifica que no haya errores (debe mostrar mensajes de éxito)

3. **Si el script indica que el usuario no existe**:
   - Ve a **Authentication** → **Users** → **Add User**
   - Completa:
     - Email: `tecnicos@soldgrup.com`
     - Password: `tecnicos2025`
     - Full Name: `Tecnicos`
     - Auto Confirm User: ✅ (activar)
   - Haz clic en **"Create User"**
   - Ejecuta el script `setup-tecnico-user.sql` de nuevo para asignar el rol

### Paso 2: Verificar que Funciona

1. **Inicia tu aplicación en localhost**:
   ```bash
   npm run dev
   ```

2. **Inicia sesión con el usuario "Tecnicos"**:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`

3. **Verifica que solo ves**:
   - ✅ Módulo de **"Informes de Mantenimiento"**
   - ❌ NO ves: Propuestas Comerciales, Equipos, Panel de Administración

## 🎯 ¿Qué Hace el Script?

El script `setup-tecnico-user.sql` hace TODO automáticamente:

1. ✅ **Aplica la migración de permisos**:
   - Bloquea acceso de 'mantenimiento' a proposals y equipment
   - Permite acceso de 'mantenimiento' a maintenance_reports
   - Actualiza políticas de storage para fotos de mantenimiento

2. ✅ **Asigna el rol al usuario**:
   - Si el usuario existe, asigna el rol 'mantenimiento'
   - Si el usuario no existe, te da instrucciones para crearlo

3. ✅ **Verifica la configuración**:
   - Verifica que el rol fue asignado
   - Verifica que los permisos están configurados

## 🆘 Problemas Comunes

### El usuario no existe

1. **Crea el usuario manualmente** desde Supabase Dashboard:
   - Authentication → Users → Add User
   - Usa las credenciales: `tecnicos@soldgrup.com` / `tecnicos2025`
   - Activa "Auto Confirm User"
   - Ejecuta el script de nuevo

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

1. **Verifica que aplicaste la migración**:
   - Ejecuta el script `setup-tecnico-user.sql` de nuevo
   - Verifica que no haya errores

2. **Verifica el rol del usuario**:
   ```sql
   SELECT role FROM public.user_roles
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tecnicos@soldgrup.com');
   ```
   Debe ser: `mantenimiento`

## ✅ Listo!

Una vez completado el setup:

1. ✅ El usuario "Tecnicos" está creado
2. ✅ Tiene el rol "mantenimiento" asignado
3. ✅ Solo puede acceder a "Informes de Mantenimiento"
4. ✅ NO puede acceder a propuestas comerciales ni equipos
5. ✅ Puede iniciar sesión con: `tecnicos@soldgrup.com` / `tecnicos2025`

**Prueba en localhost y luego sincroniza cuando estés listo!** 🎉

## 📝 Notas

- El usuario "Tecnicos" solo puede ver y gestionar informes de mantenimiento
- NO puede acceder a propuestas comerciales ni equipos
- NO puede acceder al panel de administración
- Puede crear, editar y ver informes de mantenimiento
- Puede subir fotos para los informes de mantenimiento
































