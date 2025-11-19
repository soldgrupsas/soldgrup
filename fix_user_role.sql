-- Script para cambiar el rol de un usuario de 'mantenimiento' a 'user'
-- Esto le dará acceso a Propuestas Comerciales, Equipos y Mantenimientos

-- INSTRUCCIONES:
-- 1. Reemplaza 'TU_EMAIL_AQUI' con el email del usuario que quieres actualizar
-- 2. Ejecuta este script en la base de datos de Supabase

-- Opción 1: Cambiar rol por email
UPDATE public.user_roles
SET role = 'user'
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'TU_EMAIL_AQUI'
);

-- Opción 2: Cambiar rol por ID de usuario (más directo)
-- Primero obtén el ID del usuario:
-- SELECT id, email FROM auth.users WHERE email = 'TU_EMAIL_AQUI';
-- Luego usa ese ID:
-- UPDATE public.user_roles SET role = 'user' WHERE user_id = 'ID_DEL_USUARIO';

-- Verificar que el cambio se aplicó correctamente
SELECT 
  u.email,
  ur.role,
  m.module_key,
  rmp.has_access
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.role_module_permissions rmp ON rmp.role = ur.role
LEFT JOIN public.modules m ON m.id = rmp.module_id
WHERE u.email = 'TU_EMAIL_AQUI'
ORDER BY m.module_key;

