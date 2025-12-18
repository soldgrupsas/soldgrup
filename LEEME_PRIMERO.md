# 👋 ¡LEE ESTO PRIMERO! - Setup Usuario "Tecnicos"

## 🎯 Objetivo
Crear un usuario "Tecnicos" que **SOLO** puede acceder a mantenimientos.

## ✅ Credenciales del Usuario
- **Email**: `tecnicos@soldgrup.com`
- **Contraseña**: `tecnicos2025`
- **Rol**: `mantenimiento`

## 🚀 Pasos Rápidos (5 minutos)

### Opción 1: Desde la Interfaz Web (MÁS FÁCIL) ⭐

1. **Inicia sesión como administrador** en tu aplicación (localhost)
2. Ve a: **Panel de administración** → **Administrar Usuarios**
3. Haz clic en **"Crear Usuario"** o el botón **"+"**
4. Completa el formulario:
   - **Email**: `tecnicos@soldgrup.com`
   - **Full Name**: `Tecnicos`
   - **Password**: `tecnicos2025`
   - **Role**: `Mantenimiento` (selecciona del dropdown)
5. Haz clic en **"Crear Usuario"**
6. ✅ ¡Listo! El usuario está creado

### Opción 2: Desde Supabase Dashboard

1. **Crea el usuario**:
   - Ve a [Supabase Dashboard](https://app.supabase.com)
   - Ve a **Authentication** → **Users** → **Add User**
   - Completa:
     - Email: `tecnicos@soldgrup.com`
     - Password: `tecnicos2025`
     - Full Name: `Tecnicos`
     - Auto Confirm User: ✅ (activar)
   - Haz clic en **"Create User"**

2. **Aplica la migración de permisos**:
   - Ve a **SQL Editor** en Supabase Dashboard
   - Abre el archivo `setup-tecnico-user.sql`
   - Copia y pega **TODO** el contenido
   - Haz clic en **"Run"** o presiona `Ctrl+Enter`
   - Verifica que no haya errores

## ⚠️ Importante: Aplicar Migración de Permisos

**SIEMPRE** debes aplicar la migración de permisos para que el usuario solo vea mantenimientos:

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Ejecuta el contenido del archivo: `setup-tecnico-user.sql`
3. Verifica que no haya errores

**O si usas Supabase CLI**:
```bash
supabase migration up
```

## ✅ Verificar que Funciona

1. **Inicia tu aplicación en localhost**:
   ```bash
   npm run dev
   ```

2. **Cierra sesión** si estás logueado como administrador

3. **Inicia sesión con el usuario "Tecnicos"**:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`

4. **Verifica que solo ves**:
   - ✅ Módulo de **"Informes de Mantenimiento"**
   - ❌ NO ves: Propuestas Comerciales, Equipos, Panel de Administración

## 🆘 Problemas Comunes

### El usuario no puede iniciar sesión

1. **Verifica que el usuario existe**:
   - Ve a Supabase Dashboard → Authentication → Users
   - Busca `tecnicos@soldgrup.com`
   - Si no existe, créalo desde la interfaz web o dashboard

2. **Verifica que el email está confirmado**:
   - El usuario debe tener "Auto Confirm User" activado
   - O verifica que `email_confirmed_at` no sea NULL

### El usuario ve módulos que no debería

1. **Aplica la migración de permisos**:
   - Ejecuta el script `setup-tecnico-user.sql` en Supabase SQL Editor
   - Verifica que no haya errores

2. **Verifica el rol del usuario**:
   ```sql
   SELECT role FROM public.user_roles
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tecnicos@soldgrup.com');
   ```
   Debe ser: `mantenimiento`

### El script SQL da error

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

3. **Si el usuario no existe**, créalo primero desde Supabase Dashboard o la interfaz web

## 📝 Archivos Importantes

- `setup-tecnico-user.sql` - Script SQL completo (aplica permisos y asigna rol)
- `INICIO_RAPIDO.md` - Guía rápida de inicio
- `SETUP_TECNICO.md` - Guía completa de setup
- `supabase/migrations/20251205000000_fix_mantenimiento_permissions.sql` - Migración de permisos

## 🎉 ¡Listo!

Una vez completado el setup:

1. ✅ El usuario "Tecnicos" está creado
2. ✅ Tiene el rol "mantenimiento" asignado
3. ✅ Solo puede acceder a "Informes de Mantenimiento"
4. ✅ NO puede acceder a propuestas comerciales ni equipos
5. ✅ Puede iniciar sesión con: `tecnicos@soldgrup.com` / `tecnicos2025`

**Prueba en localhost y luego sincroniza cuando estés listo!** 🚀

## 📞 ¿Necesitas Ayuda?

1. Revisa `INICIO_RAPIDO.md` para una guía rápida
2. Revisa `SETUP_TECNICO.md` para una guía completa
3. Verifica los archivos SQL en `supabase/migrations/`
































