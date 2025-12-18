-- ============================================================================
-- SCRIPT PARA VERIFICAR Y ARREGLAR USUARIO "TECNICOS"
-- ============================================================================
-- Este script verifica si el usuario existe y lo arregla si es necesario
-- ============================================================================

-- ============================================================================
-- PASO 1: VERIFICAR SI EL USUARIO EXISTE
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN := false;
  v_email_confirmed BOOLEAN := false;
  v_user_email TEXT := 'tecnicos@soldgrup.com';
BEGIN
  RAISE NOTICE '🔍 Verificando usuario: %', v_user_email;
  RAISE NOTICE '';

  -- Verificar si el usuario existe
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = v_user_email
  ) INTO v_user_exists;

  IF v_user_exists THEN
    -- Obtener información del usuario
    SELECT 
      id,
      CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END
    INTO v_user_id, v_email_confirmed
    FROM auth.users
    WHERE email = v_user_email;

    RAISE NOTICE '✅ Usuario encontrado: % (ID: %)', v_user_email, v_user_id;
    
    IF v_email_confirmed THEN
      RAISE NOTICE '✅ Email confirmado - El usuario puede iniciar sesión';
    ELSE
      RAISE NOTICE '❌ Email NO confirmado - El usuario NO puede iniciar sesión';
      RAISE NOTICE '';
      RAISE NOTICE '💡 Arreglando: Confirmando email...';
      
      -- Confirmar email (requiere permisos de administrador)
      BEGIN
        UPDATE auth.users 
        SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE email = v_user_email
          AND email_confirmed_at IS NULL;
        
        RAISE NOTICE '✅ Email confirmado correctamente';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Error al confirmar email: %', SQLERRM;
        RAISE NOTICE '💡 Solución manual: Ve a Supabase Dashboard > Authentication > Users';
        RAISE NOTICE '   Busca el usuario y haz clic en "Send magic link"';
      END;
    END IF;

    -- Verificar si tiene perfil
    IF EXISTS(
      SELECT 1 FROM public.profiles WHERE id = v_user_id
    ) THEN
      RAISE NOTICE '✅ Perfil existe';
    ELSE
      RAISE NOTICE '⚠️  Perfil NO existe - Creando perfil...';
      
      -- Crear perfil
      BEGIN
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (v_user_id, v_user_email, 'Tecnicos')
        ON CONFLICT (id) DO UPDATE 
        SET email = v_user_email, full_name = 'Tecnicos';
        
        RAISE NOTICE '✅ Perfil creado correctamente';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Error al crear perfil: %', SQLERRM;
      END;
    END IF;

    -- Verificar si tiene rol asignado
    IF EXISTS(
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'mantenimiento'::public.app_role
    ) THEN
      RAISE NOTICE '✅ Rol "mantenimiento" asignado correctamente';
    ELSE
      RAISE NOTICE '⚠️  Rol "mantenimiento" NO asignado - Asignando rol...';
      
      -- Asignar rol
      BEGIN
        PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
        RAISE NOTICE '✅ Rol asignado correctamente';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Error al asignar rol: %', SQLERRM;
        RAISE NOTICE '💡 Intentando método alternativo...';
        
        -- Método alternativo
        BEGIN
          INSERT INTO public.pending_role_assignments (user_id, role)
          VALUES (v_user_id, 'mantenimiento'::public.app_role)
          ON CONFLICT (user_id) DO UPDATE SET role = 'mantenimiento'::public.app_role;
          
          RAISE NOTICE '✅ Rol asignado usando método alternativo';
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE '❌ Error en método alternativo: %', SQLERRM;
        END;
      END;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 ¡Usuario verificado y configurado!';
    RAISE NOTICE '';
    RAISE NOTICE 'Credenciales:';
    RAISE NOTICE '   Email: tecnicos@soldgrup.com';
    RAISE NOTICE '   Password: tecnicos2025';
    RAISE NOTICE '   Role: mantenimiento';
    RAISE NOTICE '';
    RAISE NOTICE 'El usuario puede iniciar sesión ahora.';

  ELSE
    RAISE NOTICE '❌ Usuario NO existe: %', v_user_email;
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
-- PASO 2: VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar estado final del usuario
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email confirmado'
    ELSE '❌ Email NO confirmado'
  END as estado_email,
  p.full_name,
  ur.role,
  CASE 
    WHEN ur.role = 'mantenimiento' THEN '✅ Rol asignado'
    ELSE '❌ Rol NO asignado'
  END as estado_rol
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'tecnicos@soldgrup.com';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================





























