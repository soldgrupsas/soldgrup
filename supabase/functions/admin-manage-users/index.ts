import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AdminAction = 'create_user' | 'update_user' | 'delete_user';

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
    console.error('Error obteniendo usuario:', {
      status: userResponse.status,
      payload,
    });
    throw new Response(JSON.stringify({ error: payload?.message ?? 'Usuario no autorizado' }), {
      status: userResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userData = await userResponse.json();
  const userId: string | undefined = userData?.id;

  if (!userId) {
    console.error('No se pudo obtener el ID del usuario:', userData);
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
    console.error('Error consultando roles de administrador:', {
      status: roleResponse.status,
      payload,
      userId,
    });
    throw new Response(JSON.stringify({ error: 'No se pudo validar el rol del usuario' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const roles = await roleResponse.json();
  if (!Array.isArray(roles) || roles.length === 0) {
    console.error('Usuario no tiene rol de admin:', { userId, roles });
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

    // Crear cliente de Supabase con SERVICE_ROLE_KEY para bypass RLS
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta el token de autenticación' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let adminId: string;
    try {
      adminId = await ensureAdmin(token);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error('Error en ensureAdmin:', error);
      return new Response(JSON.stringify({ error: 'Error validando privilegios de administrador' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: { action?: AdminAction } & Record<string, unknown>;
    try {
      payload = (await req.json()) as { action?: AdminAction } & Record<string, unknown>;
    } catch (error) {
      console.error('Error parseando JSON del request:', error);
      return new Response(JSON.stringify({ error: 'El cuerpo de la petición debe ser JSON válido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

      console.log('Creando usuario con datos:', {
        email,
        full_name,
        role,
        hasPassword: !!password,
      });

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
        console.error('Rol no válido recibido:', role);
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

      // La API puede retornar el usuario directamente o dentro de { user: {...} }
      const userData = createPayload?.user || createPayload;
      const userId = userData?.id;

      console.log('Respuesta de creación de usuario:', {
        status: createResponse.status,
        ok: createResponse.ok,
        hasUser: !!createPayload?.user,
        hasDirectUser: !!createPayload?.id,
        userId: userId,
        payloadKeys: Object.keys(createPayload || {}),
      });

      if (!userId) {
        console.error('Error creando usuario: No se encontró ID del usuario en la respuesta', createPayload);
        return new Response(
          JSON.stringify({ error: createPayload?.message ?? 'No se pudo crear el usuario - ID no encontrado' }),
          {
            status: createResponse.status || 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      if (!createResponse.ok && createResponse.status !== 200 && createResponse.status !== 201) {
        console.error('Error creando usuario: Status no OK', {
          status: createResponse.status,
          payload: createPayload,
        });
        return new Response(
          JSON.stringify({ error: createPayload?.message ?? `Error HTTP ${createResponse.status}: No se pudo crear el usuario` }),
          {
            status: createResponse.status || 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const userIdString: string = userId as string;
      console.log('Usuario creado con ID:', userIdString);

      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          ...restHeaders(),
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: userIdString,
          email,
          full_name,
        }),
      });

      if (!profileResponse.ok) {
        const payload = await fetchJson(profileResponse);
        console.error('Error actualizando perfil:', payload);
      } else {
        console.log('Perfil actualizado correctamente');
      }

      console.log('=== INICIANDO ASIGNACIÓN DE ROL ===');
      console.log('Datos de entrada:', { email, full_name, role, userId: userIdString });
      console.log('Usuario creado con ID:', userIdString);
      console.log('Rol a asignar:', role);

      // Esperar un momento para asegurar que el usuario esté completamente disponible
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Espera completada, procediendo con asignación de rol...');

      // Usar función SQL assign_user_role que existe permanentemente en la base de datos
      console.log('=== INICIANDO ASIGNACIÓN DE ROL ===');
      console.log('Llamando a assign_user_role con:', { user_id: userIdString, role: role });
      
      const { data: insertData, error: insertError } = await supabaseAdmin
        .rpc('assign_user_role', {
          _user_id: userIdString,
          _role: role,
        });

      console.log('Respuesta de assign_user_role:', {
        data: insertData,
        error: insertError,
        errorDetails: insertError ? {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        } : null,
      });

      if (insertError) {
        console.error('ERROR: assign_user_role falló, intentando mecanismo de respaldo:', {
          error: insertError,
          userId: userIdString,
          role,
        });
        
        // MECANISMO DE RESPALDO: Insertar en pending_role_assignments que tiene un trigger automático
        try {
          const { data: fallbackData, error: fallbackError } = await supabaseAdmin
            .from('pending_role_assignments')
            .insert({
              user_id: userIdString,
              role: role,
            })
            .select();
          
          console.log('Resultado del mecanismo de respaldo (pending_role_assignments):', {
            data: fallbackData,
            error: fallbackError,
          });
          
          if (fallbackError) {
            console.error('ERROR CRÍTICO: Ambos mecanismos fallaron');
            throw fallbackError;
          }
          
          // Esperar un momento para que el trigger procese
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verificar que el trigger asignó el rol
          const { data: verifyData } = await supabaseAdmin
            .from('user_roles')
            .select('*')
            .eq('user_id', userIdString)
            .eq('role', role)
            .maybeSingle();
          
          if (verifyData) {
            console.log('✅ Rol asignado exitosamente mediante mecanismo de respaldo (trigger)');
            insertData = {
              success: true,
              user_id: userIdString,
              role: role,
              message: 'Rol asignado mediante mecanismo de respaldo (trigger)',
            };
          } else {
            throw new Error('El trigger no procesó la asignación de rol');
          }
        } catch (fallbackFailure: any) {
          console.error('ERROR CRÍTICO: Todos los mecanismos fallaron:', fallbackFailure);
          return new Response(
            JSON.stringify({ error: `No se pudo asignar el rol: ${insertError.message}. Mecanismo de respaldo también falló: ${fallbackFailure.message || 'Error desconocido'}` }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }

      // assign_user_role retorna un objeto JSONB con { success, user_id, role, message }
      if (!insertData || !insertData.success) {
        console.error('ERROR: assign_user_role no retornó éxito:', insertData);
        return new Response(
          JSON.stringify({ error: 'El rol no se asignó correctamente' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      // Verificación adicional: confirmar que user_roles tiene el registro esperado
      const { data: postVerifyData } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', userIdString)
        .eq('role', role)
        .maybeSingle();

      if (!postVerifyData) {
        console.warn('Advertencia: No se encontró el rol justo después de assign_user_role. Activando mecanismo de respaldo.');
        // Reutilizar mecanismo de respaldo
        const { error: fallbackError2 } = await supabaseAdmin
          .from('pending_role_assignments')
          .insert({ user_id: userIdString, role: role });
        if (fallbackError2) {
          console.error('Error en mecanismo de respaldo posterior:', fallbackError2);
          return new Response(
            JSON.stringify({ error: 'El rol no se pudo verificar ni asignar con el respaldo' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        // Esperar al trigger y re-verificar
        await new Promise(r => setTimeout(r, 800));
        const { data: postVerifyData2 } = await supabaseAdmin
          .from('user_roles')
          .select('*')
          .eq('user_id', userIdString)
          .eq('role', role)
          .maybeSingle();
        if (!postVerifyData2) {
          console.error('Error: Tras mecanismo de respaldo, el rol sigue sin aparecer.');
          return new Response(
            JSON.stringify({ error: 'El rol no se pudo asignar incluso con el respaldo' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      console.log('✅ Rol asignado exitosamente:', insertData);
      console.log('=== ASIGNACIÓN DE ROL COMPLETADA ===');

      return new Response(
        JSON.stringify({
          id: userIdString,
          email,
          full_name,
          role,
          _debug: {
            assignRoleResult: insertData,
            assignRoleSuccess: insertData?.success,
            assignedRole: insertData?.role,
            message: insertData?.message,
          }
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

      console.log('=== INICIANDO ACTUALIZACIÓN DE ROL ===');
      console.log('Llamando a assign_user_role con:', { user_id: userId, role: role });

      // Usar función SQL assign_user_role que existe permanentemente en la base de datos
      const { data: updateRoleData, error: updateRoleError } = await supabaseAdmin
        .rpc('assign_user_role', {
          _user_id: userId,
          _role: role,
        });

      console.log('Respuesta de assign_user_role:', {
        data: updateRoleData,
        error: updateRoleError,
        errorDetails: updateRoleError ? {
          message: updateRoleError.message,
          code: updateRoleError.code,
          details: updateRoleError.details,
        } : null,
      });

      if (updateRoleError) {
        console.error('ERROR: assign_user_role falló en update, intentando mecanismo de respaldo:', {
          error: updateRoleError,
          userId,
          role,
        });
        
        // MECANISMO DE RESPALDO: Insertar en pending_role_assignments
        try {
          const { data: fallbackData, error: fallbackError } = await supabaseAdmin
            .from('pending_role_assignments')
            .insert({
              user_id: userId,
              role: role,
            })
            .select();
          
          console.log('Resultado del mecanismo de respaldo (pending_role_assignments):', {
            data: fallbackData,
            error: fallbackError,
          });
          
          if (fallbackError) {
            console.error('ERROR CRÍTICO: Ambos mecanismos fallaron en update');
            throw fallbackError;
          }
          
          // Esperar un momento para que el trigger procese
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verificar que el trigger asignó el rol
          const { data: verifyData } = await supabaseAdmin
            .from('user_roles')
            .select('*')
            .eq('user_id', userId)
            .eq('role', role)
            .maybeSingle();
          
          if (verifyData) {
            console.log('✅ Rol actualizado exitosamente mediante mecanismo de respaldo (trigger)');
            updateRoleData = {
              success: true,
              user_id: userId,
              role: role,
              message: 'Rol actualizado mediante mecanismo de respaldo (trigger)',
            };
          } else {
            throw new Error('El trigger no procesó la actualización de rol');
          }
        } catch (fallbackFailure: any) {
          console.error('ERROR CRÍTICO: Todos los mecanismos fallaron en update:', fallbackFailure);
          return new Response(
            JSON.stringify({ error: `No se pudo actualizar el rol: ${updateRoleError.message}. Mecanismo de respaldo también falló: ${fallbackFailure.message || 'Error desconocido'}` }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }

      // assign_user_role retorna un objeto JSONB con { success, user_id, role, message }
      if (!updateRoleData || !updateRoleData.success) {
        console.error('ERROR: assign_user_role no retornó éxito:', updateRoleData);
        return new Response(
          JSON.stringify({ error: 'El rol no se actualizó correctamente' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      console.log('✅ Rol actualizado exitosamente:', updateRoleData);
      console.log('=== ACTUALIZACIÓN DE ROL COMPLETADA ===');

      return new Response(
        JSON.stringify({
          id: userId,
          email,
          full_name,
          role,
          _debug: {
            assignRoleResult: updateRoleData,
            assignRoleSuccess: updateRoleData?.success,
            assignedRole: updateRoleData?.role,
            message: updateRoleData?.message,
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'delete_user') {
      const { userId } = payload as { userId?: string };

      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId es requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validar que no se está eliminando a sí mismo
      if (userId === adminId) {
        return new Response(JSON.stringify({ error: 'No puedes eliminarte a ti mismo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Eliminar usuario (esto eliminará cascade los roles y permisos)
      const deleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: restHeaders(),
      });

      if (!deleteResponse.ok) {
        const payload = await fetchJson(deleteResponse);
        return new Response(JSON.stringify({ error: payload?.message ?? 'No se pudo eliminar el usuario' }), {
          status: deleteResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      details: process.env.DENO_ENV === 'development' ? String(error) : undefined,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
