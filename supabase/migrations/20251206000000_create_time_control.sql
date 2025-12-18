-- Time Control (Control entrada/salida) tables and storage bucket

-- Create workers table
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
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

-- Indexes
create index if not exists idx_workers_created_at on public.workers (created_at desc);
create index if not exists idx_attendance_records_worker_id on public.attendance_records (worker_id);
create index if not exists idx_attendance_records_date on public.attendance_records (date desc);
create index if not exists idx_attendance_records_worker_date on public.attendance_records (worker_id, date desc);

-- Ensure updated_at keeps track of modifications
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_workers_updated_at
  before update on public.workers
  for each row
  execute function public.update_updated_at_column();

create trigger trg_attendance_records_updated_at
  before update on public.attendance_records
  for each row
  execute function public.update_updated_at_column();

-- Enable RLS
alter table public.workers enable row level security;
alter table public.attendance_records enable row level security;

-- RLS Policies for workers
create policy "Authenticated users can manage workers"
  on public.workers
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

-- RLS Policies for attendance_records
create policy "Authenticated users can manage attendance records"
  on public.attendance_records
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

-- Storage bucket for attendance photos
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

-- Storage policies for attendance photos
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

-- Add time-control module
insert into public.modules (module_key, module_name, module_path, description)
values ('time-control', 'Control entrada/salida', '/time-control', 'Control de horarios de entrada y salida de trabajadores')
on conflict (module_key) do nothing;

-- Grant permissions to roles
-- Admin: acceso a todos los módulos (already handled by existing logic)
-- User: acceso a time-control
insert into public.role_module_permissions (role, module_id, has_access)
select 'user', id, true
from public.modules
where module_key = 'time-control'
on conflict (role, module_id) do update set has_access = true;

-- Mantenimiento: acceso a time-control (optional, can be removed if not needed)
insert into public.role_module_permissions (role, module_id, has_access)
select 'mantenimiento', id, true
from public.modules
where module_key = 'time-control'
on conflict (role, module_id) do update set has_access = true;

























