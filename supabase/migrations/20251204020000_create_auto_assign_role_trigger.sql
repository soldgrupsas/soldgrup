-- Trigger automático para asignar rol cuando se crea un usuario
-- Este es un mecanismo de respaldo en caso de que la Edge Function falle

-- Primero, crear una tabla temporal para almacenar roles pendientes
CREATE TABLE IF NOT EXISTS public.pending_role_assignments (
  user_id UUID PRIMARY KEY,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Comentario
COMMENT ON TABLE public.pending_role_assignments IS 
'Tabla temporal para almacenar asignaciones de roles pendientes. 
La Edge Function inserta aquí primero, y luego un trigger lo asigna automáticamente.';

-- Función que se ejecuta después de insertar en pending_role_assignments
CREATE OR REPLACE FUNCTION public.auto_assign_role_from_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Eliminar roles previos del usuario
  DELETE FROM public.user_roles WHERE user_id = NEW.user_id;
  
  -- Insertar el nuevo rol
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, NEW.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Eliminar el registro pendiente después de procesarlo
  DELETE FROM public.pending_role_assignments WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS on_pending_role_assignment ON public.pending_role_assignments;
CREATE TRIGGER on_pending_role_assignment
  AFTER INSERT ON public.pending_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_role_from_pending();

-- Comentarios
COMMENT ON FUNCTION public.auto_assign_role_from_pending() IS 
'Trigger function que asigna automáticamente roles desde pending_role_assignments a user_roles.';

