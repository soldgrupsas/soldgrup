-- Add geolocation fields to attendance_records table
-- These fields store the GPS coordinates where the entry/exit photos were taken

ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS entry_latitude double precision,
ADD COLUMN IF NOT EXISTS entry_longitude double precision,
ADD COLUMN IF NOT EXISTS exit_latitude double precision,
ADD COLUMN IF NOT EXISTS exit_longitude double precision;

-- Add comments for documentation
COMMENT ON COLUMN public.attendance_records.entry_latitude IS 'GPS latitude where entry photo was taken';
COMMENT ON COLUMN public.attendance_records.entry_longitude IS 'GPS longitude where entry photo was taken';
COMMENT ON COLUMN public.attendance_records.exit_latitude IS 'GPS latitude where exit photo was taken';
COMMENT ON COLUMN public.attendance_records.exit_longitude IS 'GPS longitude where exit photo was taken';














