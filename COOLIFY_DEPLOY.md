# Solución: Cambios no se suben a Coolify

## Problema
Los cambios realizados (RichTextEditor en informes) no se están reflejando en Coolify después del redeploy.

## Verificación de Cambios

Los cambios ya están commiteados y pusheados al repositorio remoto:
- ✅ Cambios en `src/pages/ElevatorMaintenanceReportWizard.tsx`
- ✅ Cambios en `src/pages/MaintenanceReportWizard.tsx`
- ✅ Commit actual: `891d28c`

## Soluciones

### Opción 1: Forzar Redeploy en Coolify (RECOMENDADO)

1. **Accede a Coolify Dashboard**
2. **Ve a tu aplicación** (soldgrup)
3. **Haz clic en "Redeploy"** o "Force Redeploy"
4. **Espera a que termine el build**

### Opción 2: Verificar Webhook de GitHub

Si Coolify usa webhooks automáticos:

1. **Verifica en GitHub**:
   - Ve a tu repositorio: `https://github.com/soldgrupsas/soldgrup`
   - Settings → Webhooks
   - Verifica que el webhook de Coolify esté activo

2. **Haz un commit vacío para forzar el webhook**:
   ```bash
   git commit --allow-empty -m "trigger: force redeploy"
   git push origin main
   ```

### Opción 3: Verificar Logs del Build

1. **En Coolify Dashboard**:
   - Ve a tu aplicación
   - Abre la sección "Logs" o "Build Logs"
   - Verifica si hay errores en el build

2. **Verifica el build localmente**:
   ```bash
   npm run build:coolify
   ```
   Esto debería generar los archivos en `docs/`

### Opción 4: Limpiar Caché de Coolify

Si Coolify está usando caché antigua:

1. **En Coolify Dashboard**:
   - Ve a tu aplicación
   - Busca la opción "Clear Cache" o "Rebuild without cache"
   - Ejecuta un redeploy sin caché

## Verificación Post-Deploy

Después del redeploy, verifica:

1. **Los archivos compilados** deben estar en `docs/`
2. **El componente RichTextEditor** debe estar disponible
3. **Los campos `initialState` y `recommendations`** deben usar RichTextEditor

## Comandos Útiles

```bash
# Verificar cambios locales vs remoto
git fetch origin
git log HEAD..origin/main --oneline

# Forzar push si es necesario
git push origin main --force-with-lease

# Verificar que los cambios están en GitHub
git log --oneline -5
```

## Nota Importante

Los cambios ya están en el repositorio remoto. El problema es que Coolify necesita ser notificado o forzado a hacer un nuevo build. Una vez que Coolify haga el redeploy, los cambios deberían estar disponibles.

