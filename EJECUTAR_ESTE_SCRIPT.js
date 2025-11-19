/**
 * ⚡ SCRIPT PARA CREAR USUARIO "TECNICOS" AUTOMÁTICAMENTE
 * 
 * INSTRUCCIONES:
 * 1. Inicia sesión como ADMINISTRADOR en tu aplicación
 * 2. Ve a: Panel de administración > Administrar Usuarios
 * 3. Abre la consola del navegador (presiona F12)
 * 4. Ve a la pestaña "Console"
 * 5. Copia y pega TODO este código
 * 6. Presiona Enter
 * 7. El usuario se creará automáticamente
 * 
 * Credenciales del usuario:
 * - Email: tecnicos@soldgrup.com
 * - Password: tecnicos2025
 * - Role: mantenimiento
 */

(async function crearUsuarioTecnicos() {
  console.log('🚀 Iniciando creación de usuario "Tecnicos"...');
  console.log('');
  
  try {
    // Obtener el cliente de Supabase desde la aplicación
    // Nota: Esto funciona si estás en la página de administración
    const { supabase } = await import('/src/integrations/supabase/client.ts');
    
    console.log('✅ Cliente de Supabase obtenido');
    console.log('📝 Creando usuario...');
    
    // Llamar a la función Edge Function para crear el usuario
    const { data, error } = await supabase.functions.invoke("admin-manage-users", {
      body: {
        action: "create_user",
        email: "tecnicos@soldgrup.com",
        password: "tecnicos2025",
        full_name: "Tecnicos",
        role: "mantenimiento",
      },
    });

    // Verificar errores
    if (error) {
      console.error('❌ Error de Supabase:', error);
      throw new Error(error.message || "Error al crear usuario");
    }

    if (data && data.error) {
      console.error('❌ Error en la respuesta:', data.error);
      throw new Error(data.error);
    }

    // Verificar si el usuario ya existe
    if (data && data.id) {
      console.log('✅ ¡Usuario creado exitosamente!');
      console.log('');
      console.log('📋 Credenciales del usuario:');
      console.log('   Email: tecnicos@soldgrup.com');
      console.log('   Password: tecnicos2025');
      console.log('   Role: mantenimiento');
      console.log('   ID: ' + data.id);
      console.log('');
      console.log('🔄 Recargando página para ver el nuevo usuario...');
      
      // Recargar la página después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      console.warn('⚠️  La respuesta no contiene el ID del usuario');
      console.log('Respuesta completa:', data);
    }

  } catch (error) {
    console.error('❌ Error al crear usuario:', error.message);
    console.error('');
    console.error('🔍 Posibles causas:');
    console.error('1. No estás autenticado como administrador');
    console.error('2. La función Edge Function no está disponible');
    console.error('3. El usuario ya existe');
    console.error('4. Hay un problema de conexión');
    console.error('');
    console.error('💡 Solución alternativa:');
    console.error('Usa la interfaz web:');
    console.error('1. Ve a Panel de administración > Administrar Usuarios');
    console.error('2. Haz clic en "Crear Usuario"');
    console.error('3. Completa el formulario:');
    console.error('   - Email: tecnicos@soldgrup.com');
    console.error('   - Full Name: Tecnicos');
    console.error('   - Password: tecnicos2025');
    console.error('   - Role: Mantenimiento');
    console.error('4. Haz clic en "Crear Usuario"');
  }
})();



