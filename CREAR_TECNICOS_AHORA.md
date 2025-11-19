# 🚀 Crear Usuario "Tecnicos" AHORA

## ✅ Credenciales del Usuario
- **Email**: `tecnicos@soldgrup.com`
- **Contraseña**: `tecnicos2025`
- **Nombre**: `Tecnicos`
- **Rol**: `Mantenimiento`

## Método Rápido: Usar la Interfaz Web (2 minutos) ⭐

1. **Inicia sesión como administrador** en tu aplicación
2. Ve a: **Panel de administración** → **Administrar Usuarios**
3. Haz clic en el botón **"Crear Usuario"** o el icono **"+"**
4. Completa el formulario:
   ```
   Email: tecnicos@soldgrup.com
   Full Name: Tecnicos
   Password: tecnicos2025
   Role: Mantenimiento (selecciona del dropdown)
   ```
5. Haz clic en **"Crear Usuario"**
6. ¡Listo! El usuario está creado y listo para usar

## Método Alternativo: Script desde la Consola del Navegador

Si prefieres usar un script:

1. **Inicia sesión como administrador** en la aplicación
2. Abre la **consola del navegador** (F12)
3. Ve a la pestaña **"Console"**
4. **Copia y pega** este código:

```javascript
(async function() {
  try {
    console.log('🚀 Creando usuario "Tecnicos"...');
    
    // Obtener el cliente de Supabase desde la aplicación
    const { supabase } = await import('/src/integrations/supabase/client.ts');
    
    // Llamar a la función Edge Function
    const { data, error } = await supabase.functions.invoke("admin-manage-users", {
      body: {
        action: "create_user",
        email: "tecnicos@soldgrup.com",
        password: "tecnicos2025",
        full_name: "Tecnicos",
        role: "mantenimiento",
      },
    });

    if (error) {
      throw new Error(error.message || "Error al crear usuario");
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Usuario creado exitosamente!');
    console.log('Credenciales:');
    console.log('  Email: tecnicos@soldgrup.com');
    console.log('  Password: tecnicos2025');
    console.log('  Role: mantenimiento');
    
    // Recargar la página para ver el nuevo usuario
    window.location.reload();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Usa la interfaz web: Panel de administración > Administrar Usuarios > Crear Usuario');
  }
})();
```

5. Presiona **Enter**
6. El usuario se creará automáticamente

## ⚠️ Importante: Aplicar Migración de Permisos

Antes de que el usuario pueda usar la aplicación correctamente, **debes aplicar la migración de permisos**:

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Copia y pega el contenido del archivo:
   `supabase/migrations/20251205000000_fix_mantenimiento_permissions.sql`
4. Haz clic en **"Run"**
5. Verifica que se ejecutó correctamente

O si usas Supabase CLI:
```bash
supabase migration up
```

## ✅ Verificar que Funciona

1. **Cierra sesión** como administrador
2. **Inicia sesión** con:
   - Email: `tecnicos@soldgrup.com`
   - Password: `tecnicos2025`
3. **Verifica que solo ves** el módulo de **"Informes de Mantenimiento"**
4. **Verifica que NO puedes acceder** a:
   - Propuestas Comerciales
   - Equipos
   - Panel de Administración

## 🆘 ¿Problemas?

Si el usuario no se crea:

1. **Verifica que eres administrador**: Debes tener el rol "admin"
2. **Verifica que la Edge Function está disponible**: Ve a Supabase Dashboard > Edge Functions > admin-manage-users
3. **Verifica la consola del navegador**: Puede haber errores que te den más información

Si el usuario se crea pero no tiene los permisos correctos:

1. **Verifica que aplicaste la migración de permisos**
2. **Verifica el rol del usuario**: Debe ser "mantenimiento"
3. **Verifica los permisos del rol**: Debe tener acceso solo a "maintenance-reports"

## 📝 Notas

- El usuario "Tecnicos" solo puede ver y gestionar informes de mantenimiento
- No puede acceder a propuestas comerciales ni equipos
- No puede acceder al panel de administración
- Puede crear, editar y ver informes de mantenimiento
- Puede subir fotos para los informes de mantenimiento



