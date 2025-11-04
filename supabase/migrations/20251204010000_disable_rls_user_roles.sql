-- Deshabilitar RLS en user_roles para permitir gestión desde Edge Functions con SERVICE_ROLE_KEY
-- Esta es la solución definitiva para el problema de asignación de roles

-- Primero eliminamos las políticas existentes que podrían estar causando conflictos
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON public.user_roles;

-- Deshabilitar RLS completamente en la tabla user_roles
-- Esto permite que las Edge Functions con SERVICE_ROLE_KEY puedan gestionar roles sin restricciones
-- La seguridad se maneja a nivel de Edge Function (verificando que el usuario sea admin)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Agregar comentario explicativo
COMMENT ON TABLE public.user_roles IS 
'RLS deshabilitado intencionalmente. Esta tabla solo es accesible desde:
1. Edge Functions con SERVICE_ROLE_KEY (que validan permisos de admin)
2. Funciones SQL con SECURITY DEFINER
NO debe ser accedida directamente desde el cliente. La seguridad se maneja en la capa de aplicación.';

-- Nota: Las funciones SQL con SECURITY DEFINER (como has_role) seguirán funcionando correctamente
-- ya que no dependen de RLS para leer de esta tabla

