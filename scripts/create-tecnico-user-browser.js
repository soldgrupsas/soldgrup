/**
 * Script para ejecutar en la consola del navegador (F12)
 * Este script crea el usuario "Tecnicos" usando la API de la aplicación
 * 
 * REQUISITO: Debes estar autenticado como administrador en la aplicación
 * 
 * INSTRUCCIONES:
 * 1. Inicia sesión como administrador en la aplicación
 * 2. Abre la consola del navegador (F12)
 * 3. Ve a la pestaña "Console"
 * 4. Copia y pega este script completo
 * 5. Presiona Enter
 */

(async function() {
  try {
    console.log('🚀 Iniciando creación de usuario "Tecnicos"...');
    
    // Verificar que estamos en la aplicación
    if (typeof window === 'undefined') {
      throw new Error('Este script debe ejecutarse en el navegador');
    }

    // Obtener el token de autenticación actual
    const session = localStorage.getItem('sb-hpzfmcdmywofxioayiff-auth-token') || 
                   sessionStorage.getItem('sb-hpzfmcdmywofxioayiff-auth-token');
    
    if (!session) {
      throw new Error('No hay sesión activa. Por favor, inicia sesión como administrador primero.');
    }

    let sessionData;
    try {
      sessionData = JSON.parse(session);
    } catch (e) {
      throw new Error('No se pudo leer la sesión. Por favor, inicia sesión de nuevo.');
    }

    const token = sessionData?.access_token;
    if (!token) {
      throw new Error('No se encontró el token de autenticación. Por favor, inicia sesión como administrador.');
    }

    console.log('✅ Sesión encontrada');

    // Obtener la URL de Supabase desde la aplicación
    const SUPABASE_URL = 'https://hpzfmcdmywofxioayiff.supabase.co';
    const functionUrl = `${SUPABASE_URL}/functions/v1/admin-manage-users`;

    console.log('📝 Creando usuario...');

    // Llamar a la función Edge Function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'create_user',
        email: 'tecnicos@soldgrup.com',
        password: 'tecnicos2025',
        full_name: 'Tecnicos',
        role: 'mantenimiento',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error HTTP ${response.status}: ${response.statusText}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Usuario creado exitosamente!');
    console.log('');
    console.log('Credenciales del usuario:');
    console.log('  Email: tecnicos@soldgrup.com');
    console.log('  Password: tecnicos2025');
    console.log('  Role: mantenimiento');
    console.log('');
    console.log('El usuario puede iniciar sesión ahora.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Posibles causas:');
    console.error('1. No estás autenticado como administrador');
    console.error('2. La función Edge Function no está disponible');
    console.error('3. Hay un problema de conexión');
    console.error('');
    console.error('Solución alternativa:');
    console.error('Usa la interfaz web: Panel de administración > Administrar Usuarios > Crear Usuario');
  }
})();



