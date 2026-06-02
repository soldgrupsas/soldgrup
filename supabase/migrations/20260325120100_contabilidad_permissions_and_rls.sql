-- Rol Contabilidad: acceso solo al módulo time-control (mismo patrón que mantenimiento + time-control en 20251206000000)

INSERT INTO public.role_module_permissions (role, module_id, has_access)
SELECT 'contabilidad', id, true
FROM public.modules
WHERE module_key = 'time-control'
ON CONFLICT (role, module_id) DO UPDATE SET has_access = true;

-- Misma firma y permisos que 20251202200000_create_assign_user_role_function.sql, añadiendo validación de 'contabilidad'
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
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', _user_id;
  END IF;

  IF _role NOT IN ('admin', 'user', 'mantenimiento', 'contabilidad') THEN
    RAISE EXCEPTION 'Rol no válido: %. Los roles válidos son: admin, user, mantenimiento, contabilidad', _role;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) THEN
    RAISE EXCEPTION 'El rol no se pudo insertar correctamente después de la operación';
  END IF;

  _result := jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'role', _role,
    'message', 'Rol asignado correctamente'
  );

  RETURN _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error asignando rol: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, public.app_role) TO service_role;

COMMENT ON FUNCTION public.assign_user_role(UUID, public.app_role) IS
'Asigna un rol a un usuario. Elimina roles previos y asigna el nuevo rol. Solo ejecutable por service_role. Bypassa RLS usando SECURITY DEFINER. Retorna JSONB con el resultado de la operación.';

-- Necesaria para las políticas de storage (idempotente; misma definición que 20260218000000_fix_asistencia_rls_access.sql)
CREATE OR REPLACE FUNCTION public.is_asistencia_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = 'asistencia@soldgrup.com';
$$;

-- workers / attendance_records: misma estructura que fix_asistencia, añadiendo rol contabilidad junto a admin y user
DROP POLICY IF EXISTS "Admin and user roles can manage workers" ON public.workers;
CREATE POLICY "Admin and user roles can manage workers"
  ON public.workers
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'contabilidad'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'contabilidad'::app_role)
  );

DROP POLICY IF EXISTS "Admin and user roles can manage attendance records" ON public.attendance_records;
CREATE POLICY "Admin and user roles can manage attendance records"
  ON public.attendance_records
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'contabilidad'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR has_role(auth.uid(), 'contabilidad'::app_role)
  );

-- Storage: mismo patrón que fix_asistencia, añadiendo has_role(..., 'contabilidad')
DROP POLICY IF EXISTS "Authenticated users upload attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users upload attendance photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR has_role(auth.uid(), 'contabilidad'::app_role)
      OR public.is_asistencia_user()
    )
  );

DROP POLICY IF EXISTS "Authenticated users update attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users update attendance photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR has_role(auth.uid(), 'contabilidad'::app_role)
      OR public.is_asistencia_user()
    )
  );

DROP POLICY IF EXISTS "Authenticated users delete attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users delete attendance photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'attendance-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'user'::app_role)
      OR has_role(auth.uid(), 'contabilidad'::app_role)
      OR public.is_asistencia_user()
    )
  );
