-- Add certification and incident fields to attendance_records
-- These fields track safety certifications and incidents during entry/exit

alter table public.attendance_records
add column if not exists entry_conditions_ok boolean,
add column if not exists entry_conditions_notes text,
add column if not exists exit_had_injury boolean,
add column if not exists exit_injury_notes text,
add column if not exists exit_had_incident boolean,
add column if not exists exit_incident_notes text,
add column if not exists exit_conditions_ok boolean,
add column if not exists exit_conditions_notes text;

-- Add comments for documentation
comment on column public.attendance_records.entry_conditions_ok is 'Certifica que el trabajador entra en condiciones adecuadas';
comment on column public.attendance_records.entry_conditions_notes is 'Observaciones si no entra en condiciones adecuadas';
comment on column public.attendance_records.exit_had_injury is 'Indica si el trabajador tuvo alguna lesión durante la jornada';
comment on column public.attendance_records.exit_injury_notes is 'Observaciones sobre la lesión reportada';
comment on column public.attendance_records.exit_had_incident is 'Indica si hubo algún incidente durante la jornada';
comment on column public.attendance_records.exit_incident_notes is 'Observaciones sobre el incidente reportado';
comment on column public.attendance_records.exit_conditions_ok is 'Certifica que el trabajador sale en buenas condiciones';
comment on column public.attendance_records.exit_conditions_notes is 'Observaciones si no sale en buenas condiciones';









