/**
 * Script para crear el usuario "Tecnicos" con rol 'mantenimiento'
 * 
 * Este script crea un usuario en Supabase Auth con:
 * - Email: tecnicos@soldgrup.com
 * - Password: tecnicos2025
 * - Full Name: Tecnicos
 * - Role: mantenimiento
 * 
 * Uso:
 * 1. Asegúrate de tener las variables de entorno configuradas:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 * 
 * 2. Ejecuta el script:
 *    npx tsx scripts/create-tecnico-user.ts
 * 
 * O usando Node.js:
 *    node -r ts-node/register scripts/create-tecnico-user.ts
 */

import { createClient } from '@supabase/supabase-js';

// Obtener variables de entorno
// Asegúrate de configurar estas variables antes de ejecutar el script
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Faltan variables de entorno requeridas');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('');
  console.error('Por favor, configura las variables de entorno necesarias.');
  process.exit(1);
}

// Crear cliente de Supabase con SERVICE_ROLE_KEY para bypass RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TECNICO_EMAIL = 'tecnicos@soldgrup.com';
const TECNICO_PASSWORD = 'tecnicos2025';
const TECNICO_FULL_NAME = 'Tecnicos';
const TECNICO_ROLE = 'mantenimiento' as const;

async function createTecnicoUser() {
  try {
    console.log('🚀 Iniciando creación de usuario "Tecnicos"...');
    console.log('');
    console.log('Configuración:');
    console.log(`  Email: ${TECNICO_EMAIL}`);
    console.log(`  Password: ${TECNICO_PASSWORD}`);
    console.log(`  Full Name: ${TECNICO_FULL_NAME}`);
    console.log(`  Role: ${TECNICO_ROLE}`);
    console.log('');

    // Verificar si el usuario ya existe
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error al listar usuarios:', listError);
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email === TECNICO_EMAIL);

    if (existingUser) {
      console.log('⚠️  El usuario ya existe. Verificando configuración...');
      console.log(`  User ID: ${existingUser.id}`);
      
      // Verificar el rol actual
      const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id);
      
      if (rolesError) {
        console.error('❌ Error al verificar roles:', rolesError);
        throw rolesError;
      }

      const currentRole = rolesData?.[0]?.role;
      if (currentRole === TECNICO_ROLE) {
        console.log('✅ El usuario ya existe con el rol correcto.');
        console.log('');
        console.log('El usuario "Tecnicos" está listo para usar:');
        console.log(`  Email: ${TECNICO_EMAIL}`);
        console.log(`  Password: ${TECNICO_PASSWORD}`);
        console.log(`  Role: ${TECNICO_ROLE}`);
        return;
      } else {
        console.log(`⚠️  El usuario tiene un rol diferente (${currentRole}). Actualizando...`);
        
        // Actualizar el rol
        const { data: assignData, error: assignError } = await supabaseAdmin
          .rpc('assign_user_role', {
            _user_id: existingUser.id,
            _role: TECNICO_ROLE,
          });
        
        if (assignError) {
          console.error('❌ Error al asignar rol:', assignError);
          throw assignError;
        }
        
        console.log('✅ Rol actualizado correctamente.');
        console.log('');
        console.log('El usuario "Tecnicos" está listo para usar:');
        console.log(`  Email: ${TECNICO_EMAIL}`);
        console.log(`  Password: ${TECNICO_PASSWORD}`);
        console.log(`  Role: ${TECNICO_ROLE}`);
        return;
      }
    }

    // Crear el usuario
    console.log('📝 Creando usuario en Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: TECNICO_EMAIL,
      password: TECNICO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: TECNICO_FULL_NAME,
      },
    });

    if (authError) {
      console.error('❌ Error al crear usuario en Auth:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('No se pudo crear el usuario - no se recibió el usuario en la respuesta');
    }

    const userId = authData.user.id;
    console.log(`✅ Usuario creado en Auth. ID: ${userId}`);

    // Actualizar el perfil
    console.log('📝 Actualizando perfil...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: TECNICO_EMAIL,
        full_name: TECNICO_FULL_NAME,
      });

    if (profileError) {
      console.error('⚠️  Error al actualizar perfil (puede ser normal si el trigger lo creó):', profileError);
    } else {
      console.log('✅ Perfil actualizado.');
    }

    // Esperar un momento para asegurar que el usuario esté disponible
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Asignar el rol
    console.log('📝 Asignando rol "mantenimiento"...');
    const { data: assignData, error: assignError } = await supabaseAdmin
      .rpc('assign_user_role', {
        _user_id: userId,
        _role: TECNICO_ROLE,
      });

    if (assignError) {
      console.error('❌ Error al asignar rol:', assignError);
      console.log('⚠️  Intentando método alternativo...');
      
      // Método alternativo: insertar en pending_role_assignments
      const { error: fallbackError } = await supabaseAdmin
        .from('pending_role_assignments')
        .insert({
          user_id: userId,
          role: TECNICO_ROLE,
        });
      
      if (fallbackError) {
        console.error('❌ Error en método alternativo:', fallbackError);
        throw fallbackError;
      }
      
      // Esperar a que el trigger procese
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Rol asignado usando método alternativo.');
    } else {
      if (assignData?.success) {
        console.log('✅ Rol asignado correctamente.');
      } else {
        console.error('❌ El rol no se asignó correctamente:', assignData);
        throw new Error('El rol no se asignó correctamente');
      }
    }

    // Verificar que el rol fue asignado
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', TECNICO_ROLE)
      .maybeSingle();

    if (verifyError) {
      console.error('⚠️  Error al verificar rol:', verifyError);
    } else if (!verifyData) {
      console.error('❌ El rol no se asignó correctamente. Verifica manualmente.');
    } else {
      console.log('✅ Rol verificado correctamente.');
    }

    console.log('');
    console.log('🎉 ¡Usuario "Tecnicos" creado exitosamente!');
    console.log('');
    console.log('Credenciales:');
    console.log(`  Email: ${TECNICO_EMAIL}`);
    console.log(`  Password: ${TECNICO_PASSWORD}`);
    console.log(`  Role: ${TECNICO_ROLE}`);
    console.log('');
    console.log('El usuario puede iniciar sesión en la aplicación.');
  } catch (error) {
    console.error('');
    console.error('❌ Error al crear usuario:', error);
    console.error('');
    process.exit(1);
  }
}

// Ejecutar el script
createTecnicoUser()
  .then(() => {
    console.log('✅ Script completado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });

