const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AdminAction = 'create_user' | 'update_user';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration for admin-manage-users');
}

const restHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

const fetchJson = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
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
    throw new Response(JSON.stringify({ error: payload?.message ?? 'Usuario no autorizado' }), {
      status: userResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userData = await userResponse.json();
  const userId: string | undefined = userData?.id;

  if (!userId) {
    throw new Response(JSON.stringify({ error: 'No se pudo determinar el usuario autenticado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    console.error('Error consultando roles de administrador:', payload);
    throw new Response(JSON.stringify({ error: 'No se pudo validar el rol del usuario' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const roles = await roleResponse.json();
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Response(JSON.stringify({ error: 'Se requiere rol de administrador' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return userId;
};

const validateRole = (role: string) => ['admin', 'user', 'mantenimiento'].includes(role);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Response(JSON.stringify({ error: 'Configuración de Supabase incompleta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta el token de autenticación' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await ensureAdmin(token);

    const payload = (await req.json()) as { action?: AdminAction } & Record<string, unknown>;
    const { action } = payload;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Acción no especificada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_user') {
      const { email, password, full_name, role } = payload as {
        email?: string;
        password?: string;
        full_name?: string;
        role?: string;
      };

      if (!email || !password || !full_name || !role) {
        return new Response(
          JSON.stringify({ error: 'email, password, full_name y role son requeridos' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      if (!validateRole(role)) {
        return new Response(JSON.stringify({ error: 'Rol no válido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: restHeaders(),
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        }),
      });

      const createPayload = await fetchJson(createResponse);

      if (!createResponse.ok || !createPayload?.user?.id) {
        console.error('Error creando usuario:', createPayload);
        return new Response(
          JSON.stringify({ error: createPayload?.message ?? 'No se pudo crear el usuario' }),
          {
            status: createResponse.status || 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const userId: string = createPayload.user.id;

      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          ...restHeaders(),
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: userId,
          email,
          full_name,
        }),
      });

      if (!profileResponse.ok) {
        const payload = await fetchJson(profileResponse);
        console.error('Error actualizando perfil:', payload);
      }

      const clearRolesResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: restHeaders(),
        },
      );

      if (!clearRolesResponse.ok) {
        const payload = await fetchJson(clearRolesResponse);
        console.error('Error limpiando roles previos:', payload);
      }

      const insertRoleResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
        method: 'POST',
        headers: restHeaders(),
        body: JSON.stringify({ user_id: userId, role }),
      });

      if (!insertRoleResponse.ok) {
        const payload = await fetchJson(insertRoleResponse);
        console.error('Error asignando rol al usuario:', payload);
        return new Response(JSON.stringify({ error: 'No se pudo asignar el rol' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          id: userId,
          email,
          full_name,
          role,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'update_user') {
      const { userId, email, full_name, role, password } = payload as {
        userId?: string;
        email?: string;
        full_name?: string;
        role?: string;
        password?: string;
      };

      if (!userId || !email || !full_name || !role) {
        return new Response(
          JSON.stringify({ error: 'userId, email, full_name y role son requeridos' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      if (!validateRole(role)) {
        return new Response(JSON.stringify({ error: 'Rol no válido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateBody: Record<string, unknown> = {
        email,
        user_metadata: { full_name },
      };

      if (password) {
        updateBody.password = password;
      }

      const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: restHeaders(),
        body: JSON.stringify(updateBody),
      });

      if (!updateResponse.ok) {
        const payload = await fetchJson(updateResponse);
        console.error('Error actualizando usuario:', payload);
        return new Response(
          JSON.stringify({ error: payload?.message ?? 'No se pudo actualizar el usuario' }),
          {
            status: updateResponse.status || 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          ...restHeaders(),
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: userId,
          email,
          full_name,
        }),
      });

      if (!profileResponse.ok) {
        const payload = await fetchJson(profileResponse);
        console.error('Error actualizando perfil:', payload);
      }

      await fetch(`${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: restHeaders(),
      });

      const insertRoleResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
        method: 'POST',
        headers: restHeaders(),
        body: JSON.stringify({ user_id: userId, role }),
      });

      if (!insertRoleResponse.ok) {
        const payload = await fetchJson(insertRoleResponse);
        console.error('Error asignando rol al usuario:', payload);
        return new Response(JSON.stringify({ error: 'No se pudo asignar el rol' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          id: userId,
          email,
          full_name,
          role,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('admin-manage-users error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
