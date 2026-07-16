-- Tabla de configuración global de la aplicación (clave/valor JSON).
-- Se usa para compartir configuraciones entre todos los usuarios/equipos,
-- por ejemplo el "Horario Laboral" y la "Configuración de Horas Extras"
-- del módulo de Control de Horas.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Habilitar Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer la configuración
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede crear/modificar la configuración
DROP POLICY IF EXISTS "Authenticated users can insert app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can insert app settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can update app settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Mantener actualizado updated_at en cada modificación
CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_settings_updated_at();
