-- Ensure pgcrypto helpers are available when calling the security definer functions
create extension if not exists "pgcrypto";

create or replace function public.set_openai_api_key(new_key text, actor_id uuid, encryption_secret text)
returns void
language plpgsql
security definer
set search_path = extensions, public
as $function$
declare
  normalized_key text;
  suffix text;
  secret text;
begin
  normalized_key := nullif(trim(new_key), '');
  if normalized_key is null then
    raise exception 'La API key no puede estar vacía';
  end if;

  secret := nullif(trim(encryption_secret), '');
  if secret is null then
    raise exception 'Debes proporcionar la passphrase de cifrado';
  end if;

  if length(normalized_key) >= 4 then
    suffix := right(normalized_key, 4);
  else
    suffix := normalized_key;
  end if;

  insert into public.secure_app_settings (key, encrypted_value, key_suffix, fingerprint, updated_at, updated_by)
  values (
    'openai_api_key',
    pgp_sym_encrypt(normalized_key, secret, 'cipher-algo=aes256'),
    suffix,
    encode(digest(normalized_key, 'sha256'), 'hex'),
    now(),
    actor_id
  )
  on conflict (key) do update
  set
    encrypted_value = excluded.encrypted_value,
    key_suffix = excluded.key_suffix,
    fingerprint = excluded.fingerprint,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$function$;

revoke all on function public.set_openai_api_key(text, uuid, text) from public;
grant execute on function public.set_openai_api_key(text, uuid, text) to service_role;

create or replace function public.get_openai_api_key(encryption_secret text)
returns text
language plpgsql
security definer
set search_path = extensions, public
as $function$
declare
  encrypted_value bytea;
  secret text;
begin
  secret := nullif(trim(encryption_secret), '');
  if secret is null then
    raise exception 'Debes proporcionar la passphrase de cifrado';
  end if;

  select encrypted_value
    into encrypted_value
    from public.secure_app_settings
    where key = 'openai_api_key';

  if encrypted_value is null then
    return null;
  end if;

  return pgp_sym_decrypt(encrypted_value, secret);
end;
$function$;

revoke all on function public.get_openai_api_key(text) from public;
grant execute on function public.get_openai_api_key(text) to service_role;
