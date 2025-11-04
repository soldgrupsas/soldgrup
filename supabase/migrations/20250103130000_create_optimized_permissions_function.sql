-- Create optimized function to get user module permissions
CREATE OR REPLACE FUNCTION public.get_user_module_permissions(_user_id UUID)
RETURNS TABLE(module_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin siempre tiene acceso a todos los módulos
  SELECT DISTINCT m.module_key
  FROM modules m
  WHERE EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  UNION
  -- O permisos específicos del rol del usuario
  SELECT DISTINCT m.module_key
  FROM user_roles ur
  INNER JOIN role_module_permissions rmp ON ur.role = rmp.role
  INNER JOIN modules m ON rmp.module_id = m.id
  WHERE ur.user_id = _user_id
    AND rmp.has_access = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
    );
$$;

