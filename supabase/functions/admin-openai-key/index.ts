const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE_KEY;
const ENCRYPTION_SECRET = Deno.env.get("OPENAI_ENCRYPTION_SECRET") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration for admin-openai-key");
}

const restHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});

const fetchJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const ensureAdmin = async (userToken: string) => {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      apikey: ANON_KEY,
    },
  });

  if (!userResponse.ok) {
    const payload = await fetchJson(userResponse);
    throw new Response(JSON.stringify({ error: payload?.message ?? "Usuario no autorizado" }), {
      status: userResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userData = await userResponse.json();
  const userId: string | undefined = userData?.id;

  if (!userId) {
    throw new Response(JSON.stringify({ error: "No se pudo determinar el usuario autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const roleResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin&select=role`,
    {
      headers: restHeaders(),
    },
  );

  if (!roleResponse.ok) {
    const payload = await fetchJson(roleResponse);
    console.error("Error consultando roles de administrador:", payload);
    throw new Response(JSON.stringify({ error: "No se pudo validar el rol del usuario" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const roles = await roleResponse.json();
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Response(JSON.stringify({ error: "Se requiere rol de administrador" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return userId;
};

const getKeyMetadata = async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_openai_api_key_metadata`, {
    method: "POST",
    headers: {
      ...restHeaders(),
      Prefer: "params=single-object",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const payload = await fetchJson(response);
    console.error("Error obteniendo metadata de la API key:", payload);
    throw new Response(
      JSON.stringify({ error: "No se pudo obtener la metadata de la clave de OpenAI" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const metadata = await fetchJson(response);
  return metadata as {
    key_exists: boolean;
    key_suffix: string | null;
    updated_at: string | null;
    updated_by: string | null;
  } | null;
};

const attachUserInfo = async (metadata: Awaited<ReturnType<typeof getKeyMetadata>>) => {
  if (!metadata?.updated_by) {
    return metadata;
  }

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${metadata.updated_by}&select=full_name,email`,
    {
      headers: restHeaders(),
    },
  );

  if (!profileResponse.ok) {
    const payload = await fetchJson(profileResponse);
    console.error("No se pudo obtener el perfil del usuario que actualizó la clave:", payload);
    return metadata;
  }

  const [profile] = (await profileResponse.json()) as Array<{ full_name: string | null; email: string }>;

  return {
    ...metadata,
    updated_by_profile: profile ?? null,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Configuración de Supabase incompleta" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return new Response(JSON.stringify({ error: "Falta el token de autenticación" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let adminId: string;
  try {
    adminId = await ensureAdmin(token);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error validando token de administrador:", error);
    return new Response(JSON.stringify({ error: "Error validando privilegios de administrador" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    try {
      const metadata = await attachUserInfo(await getKeyMetadata());
      return new Response(JSON.stringify({ data: metadata ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error("Error obteniendo metadata de la clave:", error);
      return new Response(JSON.stringify({ error: "Error interno al obtener la clave" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (req.method === "POST") {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "El cuerpo de la petición debe ser JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionValue = payload?.["action"];
    const action = typeof actionValue === "string"
      ? (actionValue || "set").toLowerCase()
      : "set";

    if (action === "get") {
      try {
        const metadata = await attachUserInfo(await getKeyMetadata());
        return new Response(JSON.stringify({ data: metadata ?? null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        if (error instanceof Response) {
          return error;
        }

        console.error("Error obteniendo metadata de la clave:", error);
        return new Response(JSON.stringify({ error: "Error interno al obtener la clave" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action !== "set") {
      return new Response(JSON.stringify({ error: "Acción no soportada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKeyValue = payload?.["apiKey"];
    const apiKey = typeof apiKeyValue === "string" ? apiKeyValue.trim() : null;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Debes proporcionar un apiKey válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encryptionSecret = ENCRYPTION_SECRET.trim();
    if (!encryptionSecret) {
      console.error("OPENAI_ENCRYPTION_SECRET no está configurado en la Edge Function");
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_ENCRYPTION_SECRET no está configurada en el entorno. Configúrala desde Supabase Secrets antes de guardar la clave.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_openai_api_key`, {
      method: "POST",
      headers: {
        ...restHeaders(),
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        new_key: apiKey,
        actor_id: adminId,
        encryption_secret: encryptionSecret,
      }),
    });

    if (!response.ok) {
      const errorPayload = await fetchJson(response);
      console.error("Error guardando la clave de OpenAI:", errorPayload);
      return new Response(
        JSON.stringify({ error: "No se pudo guardar la clave de OpenAI. Revisa los logs para más detalles." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const metadata = await attachUserInfo(await getKeyMetadata());

    return new Response(
      JSON.stringify({
        message: "La clave de OpenAI fue actualizada correctamente",
        data: metadata ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ error: "Método no permitido" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
