/**
 * Script directo para crear el usuario "Tecnicos"
 * Este script intenta crear el usuario usando la URL de Supabase del proyecto
 * 
 * NOTA: Necesitas configurar SUPABASE_SERVICE_ROLE_KEY como variable de entorno
 * o pasarla como argumento
 */

import { createClient } from '@supabase/supabase-js';

// URL de Supabase del proyecto (desde client.ts)
const SUPABASE_URL = 'https://hpzfmcdmywofxioayiff.supabase.co';

// Intentar obtener SERVICE_ROLE_KEY de variables de entorno o argumentos
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2] || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no proporcionada');
  console.error('');
  console.error('Uso:');
  console.error('  npx tsx scripts/create-tecnico-user-direct.ts <SERVICE_ROLE_KEY>');
  console.error('');
  console.error('O configura la variable de entorno:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"');
  console.error('  npx tsx scripts/create-tecnico-user-direct.ts');
  console.error('');
  console.error('');
  console.error('Para obtener el SERVICE_ROLE_KEY:');
  console.error('1. Ve a tu proyecto en Supabase Dashboard');
  console.error('2. Ve a Settings > API');
  console.error('3. Copia el "service_role" key (secreto)');
  process.exit(1);
}

// Crear cliente de Supabase con SERVICE_ROLE_KEY
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
    console.log(`  URL: ${SUPABASE_URL}`);
    console.log(`  Email: ${TECNICO_EMAIL}`);
    console.log(`  Password: ${TECNICO_PASSWORD}`);
    console.log(`  Full Name: ${TECNICO_FULL_NAME}`);
    console.log(`  Role: ${TECNICO_ROLE}`);
    console.log('');

    // Verificar si el usuario ya existe
    console.log('🔍 Verificando si el usuario ya existe...');
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error al listar usuarios:', listError.message);
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
        console.error('❌ Error al verificar roles:', rolesError.message);
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
        console.log(`⚠️  El usuario tiene un rol diferente (${currentRole || 'sin rol'}). Actualizando...`);
        
        // Actualizar el rol
        const { data: assignData, error: assignError } = await supabaseAdmin
          .rpc('assign_user_role', {
            _user_id: existingUser.id,
            _role: TECNICO_ROLE,
          });
        
        if (assignError) {
          console.error('❌ Error al asignar rol:', assignError.message);
          console.log('⚠️  Intentando método alternativo...');
          
          // Método alternativo: insertar en pending_role_assignments
          const { error: fallbackError } = await supabaseAdmin
            .from('pending_role_assignments')
            .insert({
              user_id: existingUser.id,
              role: TECNICO_ROLE,
            });
          
          if (fallbackError) {
            console.error('❌ Error en método alternativo:', fallbackError.message);
            throw fallbackError;
          }
          
          // Esperar a que el trigger procese
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('✅ Rol actualizado usando método alternativo.');
        } else {
          if (assignData?.success) {
            console.log('✅ Rol actualizado correctamente.');
          } else {
            console.error('❌ El rol no se actualizó correctamente:', assignData);
            throw new Error('El rol no se actualizó correctamente');
          }
        }
        
        console.log('');
        console.log('✅ Usuario actualizado correctamente.');
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
      console.error('❌ Error al crear usuario en Auth:', authError.message);
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
      console.error('⚠️  Error al actualizar perfil (puede ser normal si el trigger lo creó):', profileError.message);
    } else {
      console.log('✅ Perfil actualizado.');
    }

    // Esperar un momento para asegurar que el usuario esté disponible
    console.log('⏳ Esperando a que el usuario esté disponible...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Asignar el rol
    console.log('📝 Asignando rol "mantenimiento"...');
    const { data: assignData, error: assignError } = await supabaseAdmin
      .rpc('assign_user_role', {
        _user_id: userId,
        _role: TECNICO_ROLE,
      });

    if (assignError) {
      console.error('❌ Error al asignar rol:', assignError.message);
      console.log('⚠️  Intentando método alternativo...');
      
      // Método alternativo: insertar en pending_role_assignments
      const { error: fallbackError } = await supabaseAdmin
        .from('pending_role_assignments')
        .insert({
          user_id: userId,
          role: TECNICO_ROLE,
        });
      
      if (fallbackError) {
        console.error('❌ Error en método alternativo:', fallbackError.message);
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
    console.log('🔍 Verificando que el rol fue asignado...');
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', TECNICO_ROLE)
      .maybeSingle();

    if (verifyError) {
      console.error('⚠️  Error al verificar rol:', verifyError.message);
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
  } catch (error: any) {
    console.error('');
    console.error('❌ Error al crear usuario:', error.message);
    if (error.details) {
      console.error('Detalles:', error.details);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
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



