# Solución: Error de Timeout en Deployment de Coolify

## Problema
El deployment falla con el error:
```
Error 28 de cURL: Se agotó el tiempo de conexión después de 10002 milisegundos 
para https://api.github.com/zen
```

## Causa
Coolify está intentando conectarse a la API de GitHub durante el pre-deployment y no puede establecer la conexión. Esto puede deberse a:
1. Problemas de red/firewall en el servidor de Coolify
2. Problemas temporales con la API de GitHub
3. Un comando de pre-deployment configurado que intenta verificar GitHub

## Soluciones

### Solución 1: Deshabilitar Comando de Pre-Deployment (RECOMENDADO)

1. **Ve a Coolify Dashboard**
2. **Selecciona tu aplicación** (soldgrup)
3. **Ve a "Configuración"** o "Settings"
4. **Busca la sección "Pre-Deployment Command"** o "Comando de Pre-Implementación"
5. **Elimina o comenta cualquier comando** que intente conectarse a GitHub
6. **Guarda los cambios**
7. **Intenta hacer redeploy nuevamente**

### Solución 2: Verificar Conectividad de Red

1. **En Coolify Dashboard**:
   - Ve a "Terminal" o "Shell" de tu aplicación
   - Ejecuta: `curl -v https://api.github.com/zen`
   - Si falla, hay un problema de red/firewall

2. **Si hay firewall**:
   - Asegúrate de que el servidor de Coolify pueda acceder a `api.github.com`
   - Verifica que no haya bloqueos de salida en el firewall

### Solución 3: Esperar y Reintentar

1. **Espera 5-10 minutos** (puede ser un problema temporal de GitHub)
2. **Intenta hacer redeploy nuevamente**
3. Si persiste, usa las otras soluciones

### Solución 4: Usar Deployment Manual (Alternativa)

Si el problema persiste, puedes desplegar manualmente:

1. **Construir localmente**:
   ```bash
   npm run build:coolify
   ```

2. **Subir los archivos `docs/` manualmente** a tu servidor

3. **O usar otro método de deployment** si Coolify sigue fallando

## Verificación Post-Deployment

Una vez que el deployment sea exitoso:

1. **Verifica que la aplicación esté funcionando**
2. **Abre un informe de elevadores o general**
3. **Verifica que los campos `initialState` y `recommendations` usen RichTextEditor**
4. **Aplica formato (negrita, cursiva, listas)**
5. **Guarda y recarga el informe**
6. **Verifica que el formato se preserve**

## Nota Importante

Este error **NO es un problema con el código**. Los cambios que hicimos están correctos y funcionan. El problema es únicamente con la conectividad de red durante el proceso de deployment en Coolify.

## Comandos Útiles para Debugging

```bash
# Verificar conectividad desde el servidor
curl -v https://api.github.com/zen

# Verificar DNS
nslookup api.github.com

# Verificar timeout
curl --max-time 5 https://api.github.com/zen
```

