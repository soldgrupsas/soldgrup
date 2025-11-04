-- Agregar política para permitir que service_role bypasse las restricciones de RLS en user_roles
-- Esta política permite que las Edge Functions con SERVICE_ROLE_KEY puedan gestionar roles sin restricciones

-- Política permisiva que permite todas las operaciones cuando auth.uid() es NULL
-- (lo cual indica que se está usando SERVICE_ROLE_KEY desde una Edge Function)
CREATE POLICY "Service role can manage all user roles"
  ON public.user_roles
  AS PERMISSIVE
  FOR ALL
  USING (
    -- Permitir si no hay usuario autenticado (SERVICE_ROLE_KEY) O si es admin
    auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Permitir si no hay usuario autenticado (SERVICE_ROLE_KEY) O si es admin
    auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin')
  );

-- Comentario explicativo
COMMENT ON POLICY "Service role can manage all user roles" ON public.user_roles IS
'Permite que las Edge Functions con SERVICE_ROLE_KEY (auth.uid() IS NULL) puedan insertar/actualizar/eliminar roles sin restricciones de RLS. También permite operaciones de usuarios admin.';

