-- Script para crear usuario "Tecnicos" con rol 'mantenimiento'
-- 
-- IMPORTANTE: Este script debe ejecutarse después de crear el usuario en Supabase Auth
-- 
-- Pasos para crear el usuario:
-- 1. Crear el usuario en Supabase Auth (Dashboard > Authentication > Users > Add User)
--    - Email: tecnicos@soldgrup.com (o el email que desees)
--    - Password: tecnicos2025
--    - Full Name: Tecnicos
--    - Marcar "Auto Confirm User" como verdadero
--
-- 2. O usar la interfaz de administración de la aplicación en /admin/users
--    - Email: tecnicos@soldgrup.com (o el email que desees)
--    - Password: tecnicos2025
--    - Full Name: Tecnicos
--    - Role: mantenimiento
--
-- 3. Si el usuario ya existe, ejecuta este script para asignar el rol correcto:
--
-- NOTA: Reemplaza 'USER_ID_DEL_USUARIO' con el ID del usuario creado

-- Asignar rol 'mantenimiento' al usuario "Tecnicos"
-- Reemplaza 'USER_ID_DEL_USUARIO' con el ID real del usuario
DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'tecnicos@soldgrup.com'; -- Cambiar si usas otro email
BEGIN
  -- Buscar el usuario por email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado. Por favor crea el usuario primero.', v_user_email;
  END IF;
  
  -- Asignar rol 'mantenimiento' usando la función assign_user_role
  PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
  
  RAISE NOTICE 'Usuario % (ID: %) asignado con rol mantenimiento exitosamente', v_user_email, v_user_id;
END $$;

-- Verificar que el rol fue asignado correctamente
-- SELECT ur.user_id, ur.role, p.email, p.full_name
-- FROM public.user_roles ur
-- JOIN public.profiles p ON p.id = ur.user_id
-- WHERE p.email = 'tecnicos@soldgrup.com'; -- Cambiar si usas otro email
