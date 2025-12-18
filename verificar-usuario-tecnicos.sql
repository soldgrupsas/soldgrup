-- Script para verificar si el usuario "Tecnicos" existe y está configurado correctamente

-- 1. Verificar si el usuario existe en auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE email = 'tecnicos@soldgrup.com';

-- 2. Verificar si el usuario tiene un perfil
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.created_at
FROM public.profiles p
WHERE p.email = 'tecnicos@soldgrup.com';

-- 3. Verificar si el usuario tiene un rol asignado
SELECT 
  ur.user_id,
  ur.role,
  p.email,
  p.full_name
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE p.email = 'tecnicos@soldgrup.com';

-- 4. Verificar si el email está confirmado
SELECT 
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmado'
    ELSE '❌ Email NO confirmado'
  END as estado_email,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN 'El usuario puede iniciar sesión'
    ELSE 'El usuario NO puede iniciar sesión - necesita confirmar email'
  END as mensaje
FROM auth.users
WHERE email = 'tecnicos@soldgrup.com';





























