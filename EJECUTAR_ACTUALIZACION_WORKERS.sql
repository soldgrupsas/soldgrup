-- ============================================
-- ACTUALIZACIÓN: Agregar campos de hoja de vida a workers
-- ============================================
-- INSTRUCCIONES:
-- 1. Si ya ejecutaste la migración anterior, ejecuta ESTE archivo
-- 2. Ve a Supabase Dashboard → SQL Editor
-- 3. Copia y pega TODO este contenido
-- 4. Haz clic en "Run" o presiona Ctrl+Enter
-- ============================================

-- Add new columns to workers table
alter table public.workers
  add column if not exists photo_url text,
  add column if not exists cedula text,
  add column if not exists fecha_nacimiento date,
  add column if not exists fecha_ingreso date,
  add column if not exists eps text,
  add column if not exists arl text,
  add column if not exists cargo text,
  add column if not exists sueldo numeric(14,2);

-- Create unique index for cedula (should be unique)
create unique index if not exists idx_workers_cedula on public.workers (cedula) where cedula is not null;

-- Add comments to columns
comment on column public.workers.photo_url is 'URL de la foto del trabajador';
comment on column public.workers.cedula is 'Número de cédula del trabajador';
comment on column public.workers.fecha_nacimiento is 'Fecha de nacimiento del trabajador';
comment on column public.workers.fecha_ingreso is 'Fecha de ingreso a la empresa';
comment on column public.workers.eps is 'EPS del trabajador';
comment on column public.workers.arl is 'ARL del trabajador';
comment on column public.workers.cargo is 'Cargo laboral del trabajador';
comment on column public.workers.sueldo is 'Sueldo del trabajador';

-- ============================================
-- ✅ ACTUALIZACIÓN COMPLETADA
-- ============================================
-- Ahora puedes agregar trabajadores con hoja de vida completa
-- ============================================

