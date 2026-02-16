-- Add manual entry/exit flags to attendance_records
-- This allows tracking when times are added manually by administrators

alter table public.attendance_records
add column if not exists is_manual_entry boolean default false,
add column if not exists is_manual_exit boolean default false;

-- Add comments for documentation
comment on column public.attendance_records.is_manual_entry is 'Indicates if the entry time was added manually (not via photo)';
comment on column public.attendance_records.is_manual_exit is 'Indicates if the exit time was added manually (not via photo)';

-- Create index for filtering manual entries
create index if not exists idx_attendance_records_manual_entry 
  on public.attendance_records (is_manual_entry) 
  where is_manual_entry = true;

create index if not exists idx_attendance_records_manual_exit 
  on public.attendance_records (is_manual_exit) 
  where is_manual_exit = true;









