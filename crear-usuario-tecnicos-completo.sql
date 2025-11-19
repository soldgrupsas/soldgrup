-- ============================================================================
-- SCRIPT PARA CREAR USUARIO "TECNICOS" COMPLETO
-- ============================================================================
-- Este script crea el usuario "Tecnicos" directamente usando la API de Supabase
-- NOTA: Este script debe ejecutarse desde Supabase Dashboard > SQL Editor
-- ============================================================================

-- IMPORTANTE: La creación de usuarios en auth.users requiere permisos de administrador
-- Si este script no funciona, crea el usuario manualmente desde:
-- 1. Supabase Dashboard > Authentication > Users > Add User
-- 2. O desde la aplicación: Panel de administración > Administrar Usuarios

-- ============================================================================
-- OPCIÓN 1: Verificar si el usuario existe
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN := false;
  v_email_confirmed BOOLEAN := false;
BEGIN
  -- Verificar si el usuario existe
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = 'tecnicos@soldgrup.com'
  ) INTO v_user_exists;

  IF v_user_exists THEN
    -- Obtener información del usuario
    SELECT 
      id,
      CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END
    INTO v_user_id, v_email_confirmed
    FROM auth.users
    WHERE email = 'tecnicos@soldgrup.com';

    RAISE NOTICE '✅ Usuario encontrado: tecnicos@soldgrup.com (ID: %)', v_user_id;
    
    IF v_email_confirmed THEN
      RAISE NOTICE '✅ Email confirmado - El usuario puede iniciar sesión';
    ELSE
      RAISE NOTICE '⚠️  Email NO confirmado - El usuario NO puede iniciar sesión';
      RAISE NOTICE '💡 Solución: Ve a Supabase Dashboard > Authentication > Users';
      RAISE NOTICE '   Busca el usuario y haz clic en "Send magic link" o confirma el email manualmente';
    END IF;

    -- Verificar si tiene rol asignado
    IF EXISTS(
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'mantenimiento'::public.app_role
    ) THEN
      RAISE NOTICE '✅ Rol "mantenimiento" asignado correctamente';
    ELSE
      RAISE NOTICE '⚠️  Rol "mantenimiento" NO asignado';
      RAISE NOTICE '💡 Solución: Ejecuta el script setup-tecnico-user.sql para asignar el rol';
    END IF;
  ELSE
    RAISE NOTICE '❌ Usuario NO existe: tecnicos@soldgrup.com';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Para crear el usuario:';
    RAISE NOTICE '   1. Ve a Supabase Dashboard > Authentication > Users > Add User';
    RAISE NOTICE '   2. O desde la aplicación: Panel de administración > Administrar Usuarios';
    RAISE NOTICE '';
    RAISE NOTICE 'Credenciales del usuario:';
    RAISE NOTICE '   Email: tecnicos@soldgrup.com';
    RAISE NOTICE '   Password: tecnicos2025';
    RAISE NOTICE '   Full Name: Tecnicos';
    RAISE NOTICE '   Auto Confirm User: ✅ (ACTIVAR)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Activa "Auto Confirm User" para que el usuario pueda iniciar sesión inmediatamente';
  END IF;
END $$;

-- ============================================================================
-- OPCIÓN 2: Crear usuario usando función (si está disponible)
-- ============================================================================
-- NOTA: Esto solo funciona si tienes permisos de administrador y la función existe

-- Intentar crear usuario usando la función de Supabase (si existe)
-- DO $$
-- DECLARE
--   v_user_id UUID;
-- BEGIN
--   -- Esta función requiere permisos de administrador
--   -- Por lo general, no está disponible desde SQL normal
--   -- Es mejor crear el usuario desde el Dashboard o la aplicación
--   
--   RAISE NOTICE '⚠️  La creación de usuarios desde SQL requiere permisos especiales';
--   RAISE NOTICE '💡 Mejor opción: Crea el usuario desde Supabase Dashboard o la aplicación';
-- END $$;

-- ============================================================================
-- OPCIÓN 3: Confirmar email del usuario (si existe pero no está confirmado)
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN := false;
  v_email_confirmed BOOLEAN := false;
BEGIN
  -- Verificar si el usuario existe pero no está confirmado
  SELECT 
    id,
    CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END
  INTO v_user_id, v_email_confirmed
  FROM auth.users
  WHERE email = 'tecnicos@soldgrup.com';

  IF v_user_id IS NOT NULL AND NOT v_email_confirmed THEN
    RAISE NOTICE '⚠️  Usuario existe pero email NO confirmado';
    RAISE NOTICE '💡 Solución 1: Ve a Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '   Busca el usuario y haz clic en "Send magic link"';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Solución 2: Confirma el email manualmente ejecutando:';
    RAISE NOTICE '   UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = ''tecnicos@soldgrup.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NOTA: Esto requiere permisos de administrador';
  END IF;
END $$;

-- ============================================================================
-- SOLUCIÓN RÁPIDA: Confirmar email del usuario (si existe)
-- ============================================================================
-- Descomenta las siguientes líneas si el usuario existe pero no está confirmado
-- y tienes permisos de administrador

-- UPDATE auth.users 
-- SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
-- WHERE email = 'tecnicos@soldgrup.com'
--   AND email_confirmed_at IS NULL;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================



