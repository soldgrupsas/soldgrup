# Gestión de la clave de OpenAI

Esta aplicación ahora cuenta con un flujo centralizado para administrar la API key de OpenAI desde la sección de administración (`/admin/openai`). La clave es única para toda la organización y se guarda cifrada en la base de datos de Supabase.

## Dónde se almacena

- Tabla: `public.secure_app_settings`
- Fila única con `key = 'openai_api_key'`.
- El valor se cifra con `pgp_sym_encrypt` usando una passphrase externa (`OPENAI_ENCRYPTION_SECRET`) que solo vive como variable de entorno en las Edge Functions.
- Se guardan metadatos adicionales: sufijo visible (últimos 4 caracteres), hash SHA-256 y quién realizó la última actualización.
- El acceso directo a la tabla está bloqueado por RLS; solo funciones `SECURITY DEFINER` pueden leer o escribir.

## Funciones SQL disponibles

- `set_openai_api_key(new_key text, actor_id uuid, encryption_secret text)`: cifra y reemplaza la clave usando la passphrase que recibe como argumento.
- `get_openai_api_key(encryption_secret text)`: devuelve la clave en texto plano (solo para llamados con rol `service_role`).
- `get_openai_api_key_metadata()`: expone metadatos de auditoría (sin incluir la clave completa).

Estas funciones solo están disponibles para el rol `service_role`, por lo que deben ser invocadas desde Edge Functions u otros servicios backend seguros.

## Edge Function `admin-openai-key`

Ruta: `supabase/functions/admin-openai-key/index.ts`  
Acciones soportadas vía POST:

- `{ "action": "get" }`: devuelve la metadata de la clave.
- `{ "action": "set", "apiKey": "sk-..." }`: cifra y guarda la nueva clave.

Internamente la función valida que el usuario autenticado tenga rol `admin`, obtiene `OPENAI_ENCRYPTION_SECRET` desde las variables de entorno de la función y se la pasa a `set_openai_api_key`.

## Configuración requerida

1. **Configurar la passphrase de cifrado** (se hace una sola vez). Esta passphrase NUNCA se guarda en la base de datos:

   ```bash
   supabase secrets set OPENAI_ENCRYPTION_SECRET="frase-super-secreta" --project-ref hpzfmcdmywofxioayiff
   ```

2. **Aplicar las migraciones pendientes** relacionadas con la clave (por ejemplo `20251122153000_secure_openai_api_key.sql` y `20251201120000_fix_pgcrypto_search_path.sql`) para crear la tabla, instalar `pgcrypto` y exponer las funciones con el `search_path` correcto.

Sin la variable `OPENAI_ENCRYPTION_SECRET` la función `set_openai_api_key` devolverá un error indicando que falta la passphrase.

## Cómo consumir la clave desde nuevos desarrollos

Siempre debe hacerse desde el backend (Edge Functions, servicios internos, etc.) utilizando el rol `service_role`. Ejemplos:

- Edge Function que necesite invocar OpenAI:

  ```ts
  const encryptionSecret = Deno.env.get("OPENAI_ENCRYPTION_SECRET") ?? "";

  if (!encryptionSecret) {
    throw new Error("OPENAI_ENCRYPTION_SECRET no configurada");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_openai_api_key`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      encryption_secret: encryptionSecret,
    }),
  });

  const apiKey: string | null = await response.json();
  ```

  Usar siempre `service_role` o un entorno seguro; nunca expongas la clave al cliente.

- Si deseas conocer solo el estado (por ejemplo, mostrar si hay clave configurada), invoca `get_openai_api_key_metadata` y muestra el sufijo (`key_suffix`) que se guarda para auditoría.

## Flujo para administradores

1. Visitar `/admin/openai`.
2. Ingresar la nueva API key en el formulario y pulsar **Guardar clave**.
3. El módulo muestra el sufijo visible y quién fue la última persona que actualizó la clave.

Todos los usuarios autenticados pueden usar funcionalidades que dependan de OpenAI, porque las funciones de backend utilizarán la clave centralizada.
