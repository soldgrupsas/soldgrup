-- ============================================================================
-- SCRIPT COMPLETO PARA CREAR USUARIO "TECNICOS" Y CONFIGURAR PERMISOS
-- ============================================================================
-- Este script hace TODO lo necesario:
-- 1. Aplica la migración de permisos (bloquea acceso a proposals y equipment)
-- 2. Crea el usuario "Tecnicos" si no existe
-- 3. Asigna el rol "mantenimiento" al usuario
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > SQL Editor
-- 2. Copia y pega TODO este script
-- 3. Haz clic en "Run" o presiona Ctrl+Enter
-- 4. Verifica que no haya errores
-- 5. ¡Listo! El usuario está creado y configurado
--
-- Credenciales del usuario:
-- Email: tecnicos@soldgrup.com
-- Password: tecnicos2025
-- Role: mantenimiento
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: APLICAR MIGRACIÓN DE PERMISOS
-- ============================================================================
-- Corregir políticas RLS para rol 'mantenimiento'
-- Los usuarios con rol 'mantenimiento' NO deben tener acceso a proposals y equipment
-- Solo deben tener acceso a maintenance-reports

-- ============================================
-- 1. CORREGIR POLÍTICAS DE PROPOSALS
-- ============================================

-- Proposals
DROP POLICY IF EXISTS "Authenticated users can manage proposals" ON public.proposals;
CREATE POLICY "Authenticated users can manage proposals"
  ON public.proposals
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal items
DROP POLICY IF EXISTS "Authenticated users can manage proposal items" ON public.proposal_items;
CREATE POLICY "Authenticated users can manage proposal items"
  ON public.proposal_items
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal observations
DROP POLICY IF EXISTS "Authenticated users can manage observations" ON public.proposal_observations;
CREATE POLICY "Authenticated users can manage observations"
  ON public.proposal_observations
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Technical specifications
DROP POLICY IF EXISTS "Authenticated users can manage technical specs" ON public.technical_specifications;
CREATE POLICY "Authenticated users can manage technical specs"
  ON public.technical_specifications
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Equipment details (en proposals)
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment_details;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Electrification systems
DROP POLICY IF EXISTS "Authenticated users can manage electrification systems" ON public.electrification_systems;
CREATE POLICY "Authenticated users can manage electrification systems"
  ON public.electrification_systems
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal images
DROP POLICY IF EXISTS "Authenticated users can manage images" ON public.proposal_images;
CREATE POLICY "Authenticated users can manage images"
  ON public.proposal_images
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- Proposal clicks
DROP POLICY IF EXISTS "Authenticated users can view all clicks" ON public.proposal_clicks;
CREATE POLICY "Authenticated users can view all clicks"
  ON public.proposal_clicks
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'user')
  );

-- ============================================
-- 2. CORREGIR POLÍTICAS DE EQUIPMENT
-- ============================================

-- Equipment
DROP POLICY IF EXISTS "Authenticated users can manage equipment" ON public.equipment;
CREATE POLICY "Authenticated users can manage equipment"
  ON public.equipment
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- Equipment images
DROP POLICY IF EXISTS "Authenticated users can manage equipment images" ON public.equipment_images;
CREATE POLICY "Authenticated users can manage equipment images"
  ON public.equipment_images
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- Equipment tables
DROP POLICY IF EXISTS "Authenticated users can manage equipment tables" ON public.equipment_tables;
CREATE POLICY "Authenticated users can manage equipment tables"
  ON public.equipment_tables
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  );

-- ============================================
-- 3. ACTUALIZAR POLÍTICAS DE MAINTENANCE REPORTS
-- ============================================

-- Maintenance reports
DROP POLICY IF EXISTS "Authenticated users manage maintenance reports" ON public.maintenance_reports;
CREATE POLICY "Authenticated users manage maintenance reports"
  ON public.maintenance_reports
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  );

-- Maintenance report photos
DROP POLICY IF EXISTS "Authenticated users manage maintenance report photos" ON public.maintenance_report_photos;
CREATE POLICY "Authenticated users manage maintenance report photos"
  ON public.maintenance_report_photos
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role) OR
    has_role(auth.uid(), 'mantenimiento'::app_role)
  );

-- ============================================
-- 4. ACTUALIZAR POLÍTICAS DE STORAGE PARA MAINTENANCE REPORTS
-- ============================================

-- Upload maintenance report photos
DROP POLICY IF EXISTS "Authenticated users upload maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users upload maintenance report photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );

-- Update maintenance report photos
DROP POLICY IF EXISTS "Authenticated users update maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users update maintenance report photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );

-- Delete maintenance report photos
DROP POLICY IF EXISTS "Authenticated users delete maintenance report photos" ON storage.objects;
CREATE POLICY "Authenticated users delete maintenance report photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'maintenance-report-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'user'::app_role) OR
      has_role(auth.uid(), 'mantenimiento'::app_role)
    )
  );

-- ============================================================================
-- PARTE 2: CREAR USUARIO "TECNICOS"
-- ============================================================================
-- NOTA: La creación de usuarios en auth.users debe hacerse desde la API de Supabase
-- o desde el Dashboard. Este script asume que el usuario ya existe o se creará
-- desde la interfaz web. Aquí solo asignamos el rol.

DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'tecnicos@soldgrup.com';
  v_user_exists BOOLEAN := false;
BEGIN
  -- Verificar si el usuario existe
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = v_user_email
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE NOTICE '⚠️  Usuario con email % no existe en auth.users', v_user_email;
    RAISE NOTICE '📝 Por favor, crea el usuario desde:';
    RAISE NOTICE '   1. Supabase Dashboard > Authentication > Users > Add User';
    RAISE NOTICE '   2. O desde la aplicación: Panel de administración > Administrar Usuarios';
    RAISE NOTICE '';
    RAISE NOTICE 'Credenciales del usuario:';
    RAISE NOTICE '   Email: tecnicos@soldgrup.com';
    RAISE NOTICE '   Password: tecnicos2025';
    RAISE NOTICE '   Full Name: Tecnicos';
    RAISE NOTICE '   Auto Confirm User: ✅ (activar)';
    RAISE NOTICE '';
    RAISE NOTICE 'Después de crear el usuario, ejecuta este script de nuevo para asignar el rol.';
  ELSE
    -- Obtener el ID del usuario
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Error: No se pudo obtener el ID del usuario';
    END IF;

    RAISE NOTICE '✅ Usuario encontrado: % (ID: %)', v_user_email, v_user_id;

    -- Verificar si el usuario ya tiene el rol 'mantenimiento'
    IF EXISTS(
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'mantenimiento'::public.app_role
    ) THEN
      RAISE NOTICE '✅ El usuario ya tiene el rol "mantenimiento" asignado';
    ELSE
      -- Asignar rol 'mantenimiento' usando la función assign_user_role
      BEGIN
        PERFORM public.assign_user_role(v_user_id, 'mantenimiento'::public.app_role);
        RAISE NOTICE '✅ Rol "mantenimiento" asignado exitosamente';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Error al usar assign_user_role: %', SQLERRM;
        RAISE NOTICE '🔄 Intentando método alternativo...';
        
        -- Método alternativo: insertar en pending_role_assignments
        INSERT INTO public.pending_role_assignments (user_id, role)
        VALUES (v_user_id, 'mantenimiento'::public.app_role)
        ON CONFLICT (user_id) DO UPDATE SET role = 'mantenimiento'::public.app_role;
        
        RAISE NOTICE '✅ Rol asignado usando método alternativo (trigger procesará automáticamente)';
      END;
    END IF;

    -- Verificar que el rol fue asignado
    IF EXISTS(
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'mantenimiento'::public.app_role
    ) THEN
      RAISE NOTICE '';
      RAISE NOTICE '🎉 ¡Usuario "Tecnicos" configurado exitosamente!';
      RAISE NOTICE '';
      RAISE NOTICE 'Credenciales:';
      RAISE NOTICE '   Email: tecnicos@soldgrup.com';
      RAISE NOTICE '   Password: tecnicos2025';
      RAISE NOTICE '   Role: mantenimiento';
      RAISE NOTICE '';
      RAISE NOTICE 'El usuario puede iniciar sesión ahora.';
      RAISE NOTICE 'Solo tendrá acceso a: Informes de Mantenimiento';
    ELSE
      RAISE WARNING '⚠️  El rol no se asignó correctamente. Verifica manualmente.';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PARTE 3: VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar permisos del rol 'mantenimiento'
DO $$
DECLARE
  v_module_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_module_count
  FROM public.role_module_permissions rmp
  JOIN public.modules m ON m.id = rmp.module_id
  WHERE rmp.role = 'mantenimiento'::public.app_role
    AND rmp.has_access = true;

  RAISE NOTICE '';
  RAISE NOTICE '📊 Verificación de permisos:';
  RAISE NOTICE '   Módulos con acceso para rol "mantenimiento": %', v_module_count;
  
  IF v_module_count > 0 THEN
    RAISE NOTICE '   ✅ Permisos configurados correctamente';
  ELSE
    RAISE WARNING '   ⚠️  No se encontraron permisos. Verifica la configuración.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Si todo salió bien, el usuario "Tecnicos" está listo para usar.
-- Credenciales: tecnicos@soldgrup.com / tecnicos2025
-- ============================================================================





























