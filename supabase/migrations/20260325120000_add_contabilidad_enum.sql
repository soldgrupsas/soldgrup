-- Nuevo valor de enum (debe ir en migración aparte: PG no permite usar el valor en la misma transacción)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contabilidad';
