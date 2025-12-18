# 🔧 Solución: Error "Invalid login credentials"

## ❌ Error
```
Error al iniciar sesión
Invalid login credentials
```

## 🔍 Causas Posibles

1. **El usuario no existe** en la base de datos
2. **El email no está confirmado** (email_confirmed_at es NULL)
3. **La contraseña es incorrecta**
4. **El usuario existe pero no tiene permisos para iniciar sesión**

## ✅ Solución Paso a Paso

### Paso 1: Verificar si el usuario existe

1. **Ve a Supabase Dashboard**:
   - Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Ve a **Authentication** → **Users**
   - Busca `tecnicos@soldgrup.com`

2. **Si el usuario NO existe**, créalo:
   - Haz clic en **"Add User"** → **"Create new user"**
   - Completa:
     - **Email**: `tecnicos@soldgrup.com`
     - **Password**: `tecnicos2025`
     - **Full Name**: `Tecnicos`
     - **Auto Confirm User**: ✅ **ACTIVAR** (MUY IMPORTANTE)
   - Haz clic en **"Create User"**

3. **Si el usuario existe**, verifica:
   - Que el email esté confirmado (debe tener un check verde)
   - Si no está confirmado, haz clic en **"Send magic link"** o confirma manualmente

### Paso 2: Verificar desde SQL (Opcional)

1. **Ve a Supabase Dashboard** → **SQL Editor**
2. **Ejecuta el script de verificación**:
   - Abre el archivo `verificar-usuario-tecnicos.sql`
   - Copia y pega el contenido
   - Haz clic en **"Run"**
   - Verifica los resultados

3. **Si el usuario existe pero no está confirmado**, ejecuta:
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
   WHERE email = 'tecnicos@soldgrup.com'
     AND email_confirmed_at IS NULL;
   ```

### Paso 3: Crear el usuario desde la aplicación (Alternativa)

1. **Inicia sesión como administrador** en tu aplicación (localhost)
2. **Ve a**: Panel de administración → Administrar Usuarios
3. **Haz clic en "Crear Usuario"**
4. **Completa el formulario**:
   - Email: `tecnicos@soldgrup.com`
   - Full Name: `Tecnicos`
   - Password: `tecnicos2025`
   - Role: `Mantenimiento`
5. **Haz clic en "Crear Usuario"**

### Paso 4: Verificar que funciona

1. **Cierra sesión** si estás logueado
2. **Intenta iniciar sesión** con:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`
3. **Si sigue sin funcionar**, verifica:
   - Que el email esté confirmado
   - Que la contraseña sea exactamente `tecnicos2025` (sin espacios)
   - Que el usuario exista en la base de datos

## 🆘 Solución Rápida (Si el usuario existe pero no puede iniciar sesión)

### Opción 1: Confirmar email desde SQL

1. **Ve a Supabase Dashboard** → **SQL Editor**
2. **Ejecuta**:
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = NOW()
   WHERE email = 'tecnicos@soldgrup.com'
     AND email_confirmed_at IS NULL;
   ```
3. **Verifica**:
   ```sql
   SELECT id, email, email_confirmed_at
   FROM auth.users
   WHERE email = 'tecnicos@soldgrup.com';
   ```
   `email_confirmed_at` NO debe ser NULL

### Opción 2: Enviar magic link

1. **Ve a Supabase Dashboard** → **Authentication** → **Users**
2. **Busca el usuario** `tecnicos@soldgrup.com`
3. **Haz clic en "Send magic link"**
4. **O confirma el email manualmente** desde el dashboard

### Opción 3: Cambiar contraseña

1. **Ve a Supabase Dashboard** → **Authentication** → **Users**
2. **Busca el usuario** `tecnicos@soldgrup.com`
3. **Haz clic en "Reset password"**
4. **O cambia la contraseña manualmente** a `tecnicos2025`

## 📋 Verificación Completa

Ejecuta este SQL para verificar todo:

```sql
-- Verificar usuario
SELECT 
  id,
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmado'
    ELSE '❌ Email NO confirmado'
  END as estado_email
FROM auth.users
WHERE email = 'tecnicos@soldgrup.com';

-- Verificar perfil
SELECT 
  p.id,
  p.email,
  p.full_name
FROM public.profiles p
WHERE p.email = 'tecnicos@soldgrup.com';

-- Verificar rol
SELECT 
  ur.user_id,
  ur.role,
  p.email
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE p.email = 'tecnicos@soldgrup.com';
```

## ✅ Checklist

- [ ] El usuario existe en `auth.users`
- [ ] El email está confirmado (`email_confirmed_at` NO es NULL)
- [ ] La contraseña es exactamente `tecnicos2025`
- [ ] El usuario tiene un perfil en `public.profiles`
- [ ] El usuario tiene el rol `mantenimiento` asignado
- [ ] El usuario puede iniciar sesión

## 🎯 Solución Más Rápida

1. **Ve a Supabase Dashboard** → **Authentication** → **Users**
2. **Elimina el usuario** `tecnicos@soldgrup.com` si existe (con errores)
3. **Crea el usuario de nuevo**:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`
   - Full Name: `Tecnicos`
   - **Auto Confirm User**: ✅ **ACTIVAR**
4. **Aplica la migración de permisos**:
   - Ejecuta `setup-tecnico-user.sql` en SQL Editor
5. **Intenta iniciar sesión** de nuevo

## 📝 Notas

- **"Auto Confirm User"** es MUY IMPORTANTE - sin esto, el usuario no puede iniciar sesión
- La contraseña debe ser exactamente `tecnicos2025` (sin espacios antes o después)
- El email debe ser exactamente `tecnicos@soldgrup.com` (sin espacios)
- Si el usuario existe pero no puede iniciar sesión, verifica que `email_confirmed_at` NO sea NULL

## 🆘 Si Nada Funciona

1. **Verifica que el proyecto de Supabase esté activo**
2. **Verifica que la URL de Supabase sea correcta** en `src/integrations/supabase/client.ts`
3. **Verifica que las credenciales sean correctas**:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`
4. **Intenta crear el usuario desde la aplicación** (Panel de administración → Administrar Usuarios)
5. **Verifica los logs de Supabase** para ver si hay errores
































