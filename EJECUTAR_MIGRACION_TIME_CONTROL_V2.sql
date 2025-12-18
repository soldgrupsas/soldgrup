-- ============================================
-- MIGRACIÓN: Control Entrada/Salida (VERSIÓN MEJORADA)
-- ============================================
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Copia y pega TODO este contenido
-- 3. Haz clic en "Run" o presiona Ctrl+Enter
-- 4. Si hay errores, ejecuta solo las secciones que fallan
-- ============================================

-- ============================================
-- PARTE 1: Crear tablas
-- ============================================

-- Create workers table
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  photo_url text,
  cedula text,
  fecha_nacimiento date,
  fecha_ingreso date,
  eps text,
  arl text,
  cargo text,
  sueldo numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create attendance_records table
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,
  date date not null,
  entry_time timestamptz,
  exit_time timestamptz,
  entry_photo_url text,
  exit_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(worker_id, date)
);

-- ============================================
-- PARTE 2: Crear índices
-- ============================================

create index if not exists idx_workers_created_at on public.workers (created_at desc);
create unique index if not exists idx_workers_cedula on public.workers (cedula) where cedula is not null;
create index if not exists idx_attendance_records_worker_id on public.attendance_records (worker_id);
create index if not exists idx_attendance_records_date on public.attendance_records (date desc);
create index if not exists idx_attendance_records_worker_date on public.attendance_records (worker_id, date desc);

-- ============================================
-- PARTE 3: Función para updated_at (si no existe)
-- ============================================

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================
-- PARTE 4: Triggers
-- ============================================

-- Drop triggers if they exist, then create them
drop trigger if exists trg_workers_updated_at on public.workers;
create trigger trg_workers_updated_at
  before update on public.workers
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at
  before update on public.attendance_records
  for each row
  execute function public.update_updated_at_column();

-- ============================================
-- PARTE 5: Habilitar RLS
-- ============================================

alter table public.workers enable row level security;
alter table public.attendance_records enable row level security;

-- ============================================
-- PARTE 6: Políticas RLS para workers
-- ============================================

-- Drop existing policy if it exists
drop policy if exists "Authenticated users can manage workers" on public.workers;

create policy "Authenticated users can manage workers"
  on public.workers
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

-- ============================================
-- PARTE 7: Políticas RLS para attendance_records
-- ============================================

-- Drop existing policy if it exists
drop policy if exists "Authenticated users can manage attendance records" on public.attendance_records;

create policy "Authenticated users can manage attendance records"
  on public.attendance_records
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

-- ============================================
-- PARTE 8: Storage bucket
-- ============================================

insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

-- ============================================
-- PARTE 9: Políticas de Storage
-- ============================================

-- Drop existing policies if they exist
drop policy if exists "Authenticated users upload attendance photos" on storage.objects;
drop policy if exists "Authenticated users update attendance photos" on storage.objects;
drop policy if exists "Authenticated users delete attendance photos" on storage.objects;
drop policy if exists "Anyone can view attendance photos" on storage.objects;

create policy "Authenticated users upload attendance photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'attendance-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Authenticated users update attendance photos"
  on storage.objects
  for update
  using (
    bucket_id = 'attendance-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Authenticated users delete attendance photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'attendance-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Anyone can view attendance photos"
  on storage.objects
  for select
  using (bucket_id = 'attendance-photos');

-- ============================================
-- PARTE 10: Agregar módulo time-control
-- ============================================

insert into public.modules (module_key, module_name, module_path, description)
values ('time-control', 'Control entrada/salida', '/time-control', 'Control de horarios de entrada y salida de trabajadores')
on conflict (module_key) do nothing;

-- ============================================
-- PARTE 11: Permisos para roles
-- ============================================

-- User: acceso a time-control
insert into public.role_module_permissions (role, module_id, has_access)
select 'user', id, true
from public.modules
where module_key = 'time-control'
on conflict (role, module_id) do update set has_access = true;

-- Mantenimiento: acceso a time-control
insert into public.role_module_permissions (role, module_id, has_access)
select 'mantenimiento', id, true
from public.modules
where module_key = 'time-control'
on conflict (role, module_id) do update set has_access = true;

-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
-- Si ves este mensaje sin errores, todo está bien.
-- Ahora puedes usar el módulo "Control entrada/salida"
-- ============================================



