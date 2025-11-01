-- Maintenance reports core tables and storage bucket

create table if not exists public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete set null,
  current_step integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  start_date date,
  end_date date,
  company text,
  address text,
  phone text,
  contact text,
  technician_name text,
  equipment text,
  brand text,
  model text,
  serial text,
  capacity text,
  location_pg text,
  voltage text,
  initial_state text,
  recommendations text,
  tests jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports (id) on delete cascade,
  storage_path text not null,
  description text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- indexes
create index if not exists idx_maintenance_reports_created_at on public.maintenance_reports (created_at desc);
create index if not exists idx_maintenance_reports_user_id on public.maintenance_reports (user_id);
create index if not exists idx_maintenance_report_photos_report_id on public.maintenance_report_photos (report_id);

-- ensure updated_at keeps track of modifications
create trigger trg_maintenance_reports_updated_at
  before update on public.maintenance_reports
  for each row
  execute function public.update_updated_at_column();

-- enable RLS
alter table public.maintenance_reports enable row level security;
alter table public.maintenance_report_photos enable row level security;

-- policies
create policy "Authenticated users manage maintenance reports"
  on public.maintenance_reports
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

create policy "Authenticated users manage maintenance report photos"
  on public.maintenance_report_photos
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

-- storage bucket for maintenance report photos
insert into storage.buckets (id, name, public)
values ('maintenance-report-photos', 'maintenance-report-photos', true)
on conflict (id) do nothing;

-- storage policies
create policy "Authenticated users upload maintenance report photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'maintenance-report-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Authenticated users update maintenance report photos"
  on storage.objects
  for update
  using (
    bucket_id = 'maintenance-report-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Authenticated users delete maintenance report photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'maintenance-report-photos'
    and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role))
  );

create policy "Anyone can view maintenance report photos"
  on storage.objects
  for select
  using (bucket_id = 'maintenance-report-photos');
