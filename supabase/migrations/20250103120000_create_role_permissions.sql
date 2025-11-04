-- Create modules table
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  module_path TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Create role_module_permissions table
CREATE TABLE IF NOT EXISTS public.role_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  has_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, module_id)
);

-- Enable RLS on role_module_permissions
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

-- Create function to check module access
CREATE OR REPLACE FUNCTION public.has_module_access(
  _user_id UUID, 
  _module_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin siempre tiene acceso
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.role_module_permissions rmp ON ur.role = rmp.role
    INNER JOIN public.modules m ON rmp.module_id = m.id
    WHERE ur.user_id = _user_id
      AND m.module_key = _module_key
      AND rmp.has_access = true
  )
$$;

-- RLS Policies for modules
CREATE POLICY "Anyone authenticated can view modules"
  ON public.modules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage modules"
  ON public.modules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for role_module_permissions
CREATE POLICY "Anyone authenticated can view role permissions"
  ON public.role_module_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role permissions"
  ON public.role_module_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default modules
INSERT INTO public.modules (module_key, module_name, module_path, description)
VALUES 
  ('admin', 'Panel de Administración', '/admin', 'Acceso completo al panel de administración y todas sus subpáginas'),
  ('dashboard', 'Propuestas Comerciales', '/dashboard', 'Gestión de propuestas comerciales y todas sus subpáginas'),
  ('equipment', 'Equipos', '/equipment', 'Gestión de equipos industriales y todas sus subpáginas'),
  ('maintenance-reports', 'Informes de Mantenimiento', '/maintenance-reports', 'Registros y seguimiento de informes de mantenimiento')
ON CONFLICT (module_key) DO NOTHING;

-- Insert default permissions
-- Admin: acceso a todos los módulos
INSERT INTO public.role_module_permissions (role, module_id, has_access)
SELECT 'admin', id, true
FROM public.modules
ON CONFLICT (role, module_id) DO UPDATE SET has_access = true;

-- User: acceso a dashboard, equipment y maintenance-reports
INSERT INTO public.role_module_permissions (role, module_id, has_access)
SELECT 'user', id, true
FROM public.modules
WHERE module_key IN ('dashboard', 'equipment', 'maintenance-reports')
ON CONFLICT (role, module_id) DO UPDATE SET has_access = true;

-- Mantenimiento: acceso solo a maintenance-reports
INSERT INTO public.role_module_permissions (role, module_id, has_access)
SELECT 'mantenimiento', id, true
FROM public.modules
WHERE module_key = 'maintenance-reports'
ON CONFLICT (role, module_id) DO UPDATE SET has_access = true;

