-- Función para asignar roles a usuarios (bypass RLS)
-- Esta función usa SECURITY DEFINER para bypassar las políticas RLS
-- y permite que la Edge Function asigne roles sin restricciones
-- Versión mejorada que retorna JSONB para mejor debugging

CREATE OR REPLACE FUNCTION public.assign_user_role(
  _user_id UUID,
  _role public.app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  -- Validar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', _user_id;
  END IF;

  -- Validar que el rol es válido
  IF _role NOT IN ('admin', 'user', 'mantenimiento') THEN
    RAISE EXCEPTION 'Rol no válido: %. Los roles válidos son: admin, user, mantenimiento', _role;
  END IF;

  -- Eliminar todos los roles previos del usuario
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Insertar nuevo rol
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);
  
  -- Verificar que se insertó correctamente
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) THEN
    RAISE EXCEPTION 'El rol no se pudo insertar correctamente después de la operación';
  END IF;
  
  -- Retornar resultado de éxito
  _result := jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'role', _role,
    'message', 'Rol asignado correctamente'
  );
  
  RETURN _result;
EXCEPTION
  WHEN OTHERS THEN
    -- Retornar error en formato JSON
    RAISE EXCEPTION 'Error asignando rol: %', SQLERRM;
END;
$$;

-- Otorgar permisos solo a service_role
REVOKE ALL ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) TO service_role;

-- Comentario descriptivo
COMMENT ON FUNCTION public.assign_user_role(UUID, public.app_role) IS 
'Asigna un rol a un usuario. Elimina roles previos y asigna el nuevo rol. Solo ejecutable por service_role. Bypassa RLS usando SECURITY DEFINER. Retorna JSONB con el resultado de la operación.';
