-- Enhance maintenance report photo metadata and logging

alter table public.maintenance_report_photos
  add column if not exists optimized_path text,
  add column if not exists thumbnail_path text,
  add column if not exists original_size_bytes bigint,
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz;

create table if not exists public.maintenance_photo_upload_metrics (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references public.maintenance_report_photos (id) on delete cascade,
  event text not null,
  duration_ms integer,
  size_bytes bigint,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_photo_metrics_photo_id on public.maintenance_photo_upload_metrics (photo_id);

alter table public.maintenance_photo_upload_metrics enable row level security;

create policy "Authenticated users log photo metrics" on public.maintenance_photo_upload_metrics
  for insert
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'user'::app_role));

create policy "Admins view photo metrics" on public.maintenance_photo_upload_metrics
  for select
  using (has_role(auth.uid(), 'admin'::app_role));
